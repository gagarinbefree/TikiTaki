import { VERSION_CONFIG } from '../tooling.config.mjs';
/** Display deployment metadata outside the framework-owned tree; local builds use a development label. */
export async function showDeploymentVersion(): Promise<void> {
  const output = document.createElement(VERSION_CONFIG.element);
  output.setAttribute(VERSION_CONFIG.attribute, VERSION_CONFIG.development);
  output.className = VERSION_CONFIG.className;
  output.textContent = `${VERSION_CONFIG.label}${VERSION_CONFIG.development}`;
  document.body.append(output);
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${VERSION_CONFIG.filename}`, { cache: VERSION_CONFIG.cache });
    if (!response.ok)
      return;

    const metadata: unknown = await response.json();
    if (typeof metadata === 'object' && metadata !== null && 'version' in metadata && typeof metadata.version === 'string') {
      output.textContent = `${VERSION_CONFIG.label}${metadata.version}`;
      output.setAttribute(VERSION_CONFIG.attribute, metadata.version);
    }
  } catch {
    output.textContent = `${VERSION_CONFIG.label}${VERSION_CONFIG.development}`;
  }
}
