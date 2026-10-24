import { VERSION_CONFIG } from '../tooling.config.mjs';
/** Append the repository link outside the framework-owned tree. */
export function showRepositoryLink(): void {
  const footer = document.createElement('footer');
  footer.className = VERSION_CONFIG.className;
  const link = document.createElement('a');
  link.href = VERSION_CONFIG.repository;
  link.textContent = 'GitHub';
  link.setAttribute('data-demo-repository', '');
  footer.append(link);
  document.body.append(footer);
}
