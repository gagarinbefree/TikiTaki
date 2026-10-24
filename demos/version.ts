import { VERSION_CONFIG } from '../tooling.config.mjs';
/** Link to the repository and the exact published release outside the framework-owned tree. */
export async function showRepositoryLink(): Promise<void> {
  const footer = document.createElement('footer');
  footer.className = VERSION_CONFIG.className;
  const link = document.createElement('a');
  link.href = VERSION_CONFIG.repository;
  link.textContent = 'GitHub';
  link.setAttribute('data-demo-repository', '');
  footer.append(link);
  document.body.append(footer);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${VERSION_CONFIG.filename}`, { cache: VERSION_CONFIG.cache });
    if (!response.ok) return;
    const metadata: unknown = await response.json();
    if (
      typeof metadata === 'object' &&
      metadata !== null &&
      'version' in metadata &&
      typeof metadata.version === 'string' &&
      /^\d+\.\d+\.\d+$/.test(metadata.version)
    ) {
      const release = document.createElement('a');
      release.href = `${VERSION_CONFIG.repository}/releases/tag/v${metadata.version}`;
      release.textContent = `v${metadata.version}`;
      release.setAttribute(VERSION_CONFIG.attribute, metadata.version);
      footer.append(' · ', release);
    }
  } catch {
    return;
  }
}
