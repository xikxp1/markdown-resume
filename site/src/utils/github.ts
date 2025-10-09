import * as localForage from "localforage";
import { Octokit } from "@octokit/rest";
import type { ResumeStorageItem, SaveType } from "~/types";

const GITHUB_REPO_NAME = "MARKDOWN_RESUME_REPO_NAME"
const GITHUB_TOKEN_KEY = "MARKDOWN_RESUME_GH_TOKEN";

// Persistent retry queue for handling GitHub 422 (old ref) with exponential backoff
const GITHUB_RETRY_QUEUE_KEY = "MARKDOWN_RESUME_GH_RETRY_QUEUE";
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_INITIAL_DELAY_S = 10; // 10s initial delay
const RETRY_BACKOFF_FACTOR = 2;
const RETRY_BACKOFF_CAP_S = 120; // 2 minutes cap
const GITHUB_BRANCH_REF = 'heads/main';

type RetryJob = {
  id: string;
  attempt: number;
  nextRunAt: number;
  resume: ResumeStorageItem;
  saveType: SaveType;
};

type RetryQueue = Record<string, RetryJob>;

// Keep in-memory handles for scheduled timers (per resume id)
const retryTimers = new Map<string, number>();

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function loadRetryQueue(): Promise<RetryQueue> {
  if (typeof window === "undefined") return {};
  return (await localForage.getItem<RetryQueue>(GITHUB_RETRY_QUEUE_KEY)) || {};
}

async function saveRetryQueue(q: RetryQueue): Promise<void> {
  if (typeof window === "undefined") return;
  await localForage.setItem(GITHUB_RETRY_QUEUE_KEY, q);
}

function clearTimer(id: string) {
  const existing = retryTimers.get(id);
  if (existing) {
    window.clearTimeout(existing);
    retryTimers.delete(id);
  }
}

function scheduleJob(job: RetryJob) {
  if (typeof window === "undefined") return;
  const delayMs = Math.max(0, job.nextRunAt - Date.now());
  clearTimer(job.id);
  const handle = window.setTimeout(() => {
    processRetryJob(job.id).catch((e) => {
      console.warn("[GitHub Sync][retry] job failed", { id: job.id, error: e?.message || e });
    });
  }, delayMs);
  retryTimers.set(job.id, handle);
  console.info("[GitHub Sync][retry] scheduled", { id: job.id, attempt: job.attempt, delayMs });
}

async function enqueueRetryJob(id: string, resume: ResumeStorageItem, saveType: SaveType, preferSooner = true) {
  const queue = await loadRetryQueue();
  const now = Date.now();
  const initialDelay = RETRY_INITIAL_DELAY_S * 1000;

  let job = queue[id];
  if (job) {
    // Update existing job with latest content
    job.resume = resume;
    job.saveType = saveType;
    const proposed = now + initialDelay;
    job.nextRunAt = preferSooner ? Math.min(job.nextRunAt, proposed) : proposed;
  } else {
    job = {
      id,
      attempt: 0,
      nextRunAt: now + initialDelay,
      resume,
      saveType
    };
    queue[id] = job;
  }

  await saveRetryQueue(queue);
  scheduleJob(job);
  console.info("[GitHub Sync][retry] enqueued", { id, attempt: job.attempt, nextRunAt: job.nextRunAt });
}

async function commitOnce(
  owner: string,
  repo: string,
  token: string,
  id: string,
  resume: ResumeStorageItem,
  saveType: SaveType
): Promise<void> {
  const octokit = new Octokit({ auth: token });

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: GITHUB_BRANCH_REF
  });
  const currentCommitSha = refData.object.sha;

  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha
  });
  const treeSha = commitData.tree.sha;

  const name = resume.name;

  // Create file paths for the resume
  const markdownPath = `${id}/${name}.md`;
  const cssPath = `${id}/${name}.css`;
  const stylesPath = `${id}/${name}.json`;

  // Create blobs for each file
  const markdownBlob = await octokit.git.createBlob({
    owner,
    repo,
    content: resume.markdown,
    encoding: 'utf-8'
  });

  const cssBlob = await octokit.git.createBlob({
    owner,
    repo,
    content: resume.css,
    encoding: 'utf-8'
  });

  const stylesBlob = await octokit.git.createBlob({
    owner,
    repo,
    content: JSON.stringify(resume.styles, null, 2),
    encoding: 'utf-8'
  });

  // Create a new tree with the files
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: treeSha,
    tree: [
      {
        path: markdownPath,
        mode: '100644',
        type: 'blob',
        sha: markdownBlob.data.sha
      },
      {
        path: cssPath,
        mode: '100644',
        type: 'blob',
        sha: cssBlob.data.sha
      },
      {
        path: stylesPath,
        mode: '100644',
        type: 'blob',
        sha: stylesBlob.data.sha
      }
    ]
  });

  // Create a new commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: `Update resume: ${resume.name} (${saveType}) ${resume.update}`,
    tree: newTree.sha,
    parents: [currentCommitSha]
  });

  // Update the reference to point to the new commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: GITHUB_BRANCH_REF,
    sha: newCommit.sha
  });
}

async function processRetryJob(id: string): Promise<void> {
  const queue = await loadRetryQueue();
  const job = queue[id];
  if (!job) return;

  const token = await getGithubToken();
  const { owner, repo, isEmpty } = await getRepo();

  if (!token || isEmpty || !owner || !repo) {
    // Nothing we can do; drop job
    clearTimer(id);
    delete queue[id];
    await saveRetryQueue(queue);
    console.warn("[GitHub Sync][retry] dropped job due to missing token/repo", { id });
    return;
  }

  try {
    await commitOnce(owner, repo, token, job.id, job.resume, job.saveType);
    // Success
    clearTimer(id);
    delete queue[id];
    await saveRetryQueue(queue);
    console.info("[GitHub Sync][retry] success", { id });
    const toast = useToast();
    toast.savedtoGithub();
  } catch (err: any) {
    if (err?.status === 422) {
      if (job.attempt + 1 < RETRY_MAX_ATTEMPTS) {
        job.attempt += 1;
        const base = Math.min(
          RETRY_INITIAL_DELAY_S * 1000 * Math.pow(RETRY_BACKOFF_FACTOR, job.attempt),
          RETRY_BACKOFF_CAP_S * 1000
        );
        job.nextRunAt = Date.now() + base;
        queue[id] = job;
        await saveRetryQueue(queue);
        scheduleJob(job);
        console.info("[GitHub Sync][retry] rescheduled after 422", { id, attempt: job.attempt, nextRunAt: job.nextRunAt });
      } else {
        clearTimer(id);
        delete queue[id];
        await saveRetryQueue(queue);
        console.warn("[GitHub Sync][retry] giving up after max attempts", { id, attempts: job.attempt });
      }
    } else {
      // Terminal errors - do not retry
      clearTimer(id);
      delete queue[id];
      await saveRetryQueue(queue);
      console.warn("[GitHub Sync][retry] terminal error, not retrying", { id, status: err?.status });
    }
  }
}

/**
 * Persist Github token
 */
export async function getGithubToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return localForage.getItem<string>(GITHUB_TOKEN_KEY);
}

export async function setGithubToken(token: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!token) {
    await localForage.removeItem(GITHUB_TOKEN_KEY);
    return;
  }
  await localForage.setItem(GITHUB_TOKEN_KEY, token);
}

/**
 * Persist repo name
 */
export async function getRepo(): Promise<{ owner: string | null, repo: string | null, isEmpty: boolean }> {
  if (typeof window === "undefined") return { owner: null, repo: null, isEmpty: true };
  const fullName = await localForage.getItem<string>(GITHUB_REPO_NAME);
  if (!fullName) return { owner: null, repo: null, isEmpty: true };
  const data = fullName.split("/");
  if (data.length != 2) return { owner: null, repo: null, isEmpty: false };
  const owner = data[0];
  const repo = data[1];
  return { owner, repo, isEmpty: false };
}

export async function setRepo(name: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!name) {
    await localForage.removeItem(GITHUB_REPO_NAME);
    return;
  }
  await localForage.setItem(GITHUB_REPO_NAME, name);
}

/**
 * Main function: commit a resume's markdown, css, and metadata to GitHub
 */
export async function commitResumeToGithub(
  id: string,
  resume: ResumeStorageItem,
  saveType: SaveType
): Promise<{ success: boolean; error?: string; supress?: boolean }> {
  try {
    const token = await getGithubToken();
    if (!token) {
      return { success: true, error: undefined, supress: true };
    }

    const { owner, repo, isEmpty } = await getRepo();

    if (isEmpty) {
      return { success: true, error: undefined, supress: true };
    }

    if (!owner || !repo) {
      return { success: false, error: 'github.error.incorrect_repo', supress: false };
    }

    // One-shot attempt
    await commitOnce(owner, repo, token, id, resume, saveType);

    return { success: true, error: undefined, supress: false };
  } catch (err: any) {
    // Auto-reschedule on 422 (stale ref) and suppress user-facing noise
    if (err?.status === 422) {
      try {
        await enqueueRetryJob(id, resume, saveType);
      } catch (queueErr) {
        console.warn("[GitHub Sync][retry] enqueue failed", queueErr);
      }
      console.info("[GitHub Sync][retry] scheduled due to 422", { id });
      return { success: true, error: undefined, supress: true };
    }

    // Provide readable error for toast; do not expose raw token info
    let msg = "github.error.sync_failed";
    if (err?.status === 401) {
      msg = "github.error.token_invalid";
    } else if (err?.status === 403) {
      msg = "github.error.token_insufficient_permissions";
    } else if (err?.status === 404) {
      msg = "github.error.repo_not_found";
    } else if (err?.status === 409) {
      msg = "github.error.file_conflict";
    }
    console.error("[GitHub Sync]", err);
    return { success: false, error: msg, supress: false };
  }
}

/**
 * Initialize retry queue timers from persisted storage.
 * Call once on client startup.
 */
export async function initGithubRetryQueue(): Promise<void> {
  if (typeof window === "undefined") return;
  const queue = await loadRetryQueue();
  for (const id of Object.keys(queue)) {
    scheduleJob(queue[id]);
  }
}
