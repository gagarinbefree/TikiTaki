import { VERSION_CONFIG } from '../tooling.config.mjs';
import { startResponsiveLayout } from './responsive';

/** Add repository and npm package links outside the framework-owned tree. */
export function showRepositoryLink(responsive = false): void {
  const footer = document.createElement('footer');
  footer.className = VERSION_CONFIG.className;
  const repository = document.createElement('a');
  repository.href = VERSION_CONFIG.repository;
  repository.textContent = 'GitHub';
  repository.setAttribute('data-demo-repository', '');
  const npm = document.createElement('a');
  npm.href = VERSION_CONFIG.npm;
  npm.textContent = 'npm';
  npm.setAttribute('data-demo-npm', '');
  footer.append(repository, ' · ', npm);
  document.body.append(footer);
  if (responsive) {
    const dispose = startResponsiveLayout();
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) dispose();
    };
    window.addEventListener('pagehide', onPageHide);
    import.meta.hot?.dispose(() => {
      dispose();
      window.removeEventListener('pagehide', onPageHide);
    });
  }
}
