export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return 'https://dragyou-backend.onrender.com/api/v1';
  }
  return 'http://localhost:8080/api/v1';
}

export function getCloneUrl(owner: string, repo: string): string {
  return `${getApiBase()}/repos/${owner}/${repo}`;
}

export function fmtSize(n?: number | null): string {
  if (n === undefined || n === null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export interface User {
  id: number;
  username: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
}

export interface Repository {
  id: number;
  owner_id: number;
  owner?: User;
  name: string;
  full_name: string;
  description: string;
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  star_count: number;
  fork_count: number;
  created_at: string;
  updated_at: string;
  clone_url: string;
  ssh_url: string;
}

export interface Commit {
  hash: string;
  message: string;
  author: string;
  timestamp: number;
  tree: string;
  parents: string[];
}

export interface Branch {
  name: string;
  current: boolean;
  hash: string;
}

export interface TreeItem {
  name: string;
  type: 'blob' | 'tree';
  hash: string;
  mode: string;
  size?: number;
}

export interface PullRequest {
  id: number;
  repository_id: number;
  author_id: number;
  author?: User;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  source_branch: string;
  target_branch: string;
  is_draft: boolean;
  created_at: string;
}

export interface Issue {
  id: number;
  repository_id: number;
  author_id: number;
  author?: User;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  created_at: string;
}

// Fetch helper with JWT auth support
async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('dragyou_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const base = getApiBase();
  const res = await fetch(`${base}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || errorData.error || 'API Request failed');
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data: any) => fetcher<{ access_token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => fetcher<{ access_token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => fetcher<User>('/auth/me'),
  updateProfile: (data: any) => fetcher<{ message: string; user: User }>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  // Repositories
  listRepos: () => fetcher<{ items: Repository[]; total_count: number }>('/repos'),
  getRepo: (owner: string, repo: string) => fetcher<Repository>(`/repos/${owner}/${repo}`),
  createRepo: (data: any) => fetcher<Repository>('/repos', { method: 'POST', body: JSON.stringify(data) }),
  deleteRepo: (owner: string, repo: string) => fetcher<{ message: string }>(`/repos/${owner}/${repo}`, { method: 'DELETE' }),

  // VCS details
  getCommits: (owner: string, repo: string, max = 30) => fetcher<{ commits: Commit[] }>(`/repos/${owner}/${repo}/commits?max=${max}`),
  getBranches: (owner: string, repo: string) => fetcher<{ branches: Branch[]; default_branch: string }>(`/repos/${owner}/${repo}/branches`),
  getTree: (owner: string, repo: string, ref = 'main', path = '') => {
    const cleanPath = path ? `/${path}` : '';
    return fetcher<{ items: TreeItem[] }>(`/repos/${owner}/${repo}/tree/${ref}${cleanPath}`);
  },
  getBlob: async (owner: string, repo: string, ref = 'main', path = ''): Promise<string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dragyou_token') : null;
    const base = getApiBase();
    const res = await fetch(`${base}/repos/${owner}/${repo}/blob/${ref}/${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to load blob content');
    return res.text();
  },

  // PRs & Issues
  listPullRequests: (owner: string, repo: string) => fetcher<{ pull_requests: PullRequest[] }>(`/repos/${owner}/${repo}/pulls`),
  createPullRequest: (owner: string, repo: string, data: any) => fetcher<PullRequest>(`/repos/${owner}/${repo}/pulls`, { method: 'POST', body: JSON.stringify(data) }),
  listIssues: (owner: string, repo: string) => fetcher<{ issues: Issue[] }>(`/repos/${owner}/${repo}/issues`),
  createIssue: (owner: string, repo: string, data: any) => fetcher<Issue>(`/repos/${owner}/${repo}/issues`, { method: 'POST', body: JSON.stringify(data) }),

  // Web upload — drag-and-drop commit
  uploadFiles: async (owner: string, repo: string, files: File[], message: string, branch: string): Promise<{ commit: string; files: number; branch: string; message: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('dragyou_token') : null;
    const form = new FormData();
    form.append('message', message);
    form.append('branch', branch);
    files.forEach(f => form.append('files[]', f));

    const base = getApiBase();
    const res = await fetch(`${base}/repos/${owner}/${repo}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || err.error || 'Upload failed');
    }
    return res.json();
  },
};

