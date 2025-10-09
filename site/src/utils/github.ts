import * as localForage from "localforage";
import { Octokit } from "@octokit/rest";
import type { ResumeStorageItem, SaveType } from "~/types";

const GITHUB_REPO_NAME = "MARKDOWN_RESUME_REPO_NAME"
const GITHUB_TOKEN_KEY = "MARKDOWN_RESUME_GH_TOKEN";

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

    const octokit = new Octokit({ auth: token });

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
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
      ref: 'heads/main',
      sha: newCommit.sha
    });

    return { success: true, error: undefined, supress: false };

  } catch (err: any) {
    // Provide readable error for toast; do not expose raw token info
    let msg = "github.error.sync_failed";
    if (err.status === 401) {
      msg = "github.error.token_invalid";
    } else if (err.status === 403) {
      msg = "github.error.token_insufficient_permissions";
    } else if (err.status === 404) {
      msg = "github.error.repo_not_found";
    } else if (err.status === 409) {
      msg = "github.error.file_conflict";
    }
    console.error("[GitHub Sync]", err);
    return { success: false, error: msg, supress: false };
  }
}
