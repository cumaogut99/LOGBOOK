import { Component } from '../types';

/**
 * Recursively updates component hours
 * @param components - Array of components to update
 * @param additionalHours - Hours to add to each component
 * @returns Updated components array
 */
export function updateComponentHours(
  components: Component[],
  additionalHours: number
): Component[] {
  return components.map(comp => ({
    ...comp,
    currentHours: comp.currentHours + additionalHours,
    children: comp.children
      ? updateComponentHours(comp.children, additionalHours)
      : undefined
  }));
}

/**
 * Checks life limits and returns components that are close to or exceeding their limits
 * @param components - Array of components to check
 * @param thresholdHours - Threshold in hours (default: 50)
 * @returns Array of components that need attention
 */
export function checkLifeLimits(
  components: Component[],
  thresholdHours: number = 50
): Array<Component & { remaining: number; status: 'critical' | 'warning' }> {
  const exceedingParts: Array<Component & { remaining: number; status: 'critical' | 'warning' }> = [];

  function traverse(comps: Component[]) {
    comps.forEach(comp => {
      if (comp.lifeLimit > 0) {
        const remaining = comp.lifeLimit - comp.currentHours;
        
        if (remaining <= 0) {
          exceedingParts.push({ ...comp, remaining, status: 'critical' });
        } else if (remaining <= thresholdHours) {
          exceedingParts.push({ ...comp, remaining, status: 'warning' });
        }
      }
      
      if (comp.children) traverse(comp.children);
    });
  }

  traverse(components);
  return exceedingParts;
}

/**
 * Generates a readable message for life limit warnings
 */
export function generateLifeLimitMessage(
  parts: Array<Component & { remaining: number; status: 'critical' | 'warning' }>
): string {
  if (parts.length === 0) return '';
  
  const critical = parts.filter(p => p.status === 'critical');
  const warning = parts.filter(p => p.status === 'warning');
  
  const messages: string[] = [];
  
  if (critical.length > 0) {
    messages.push(`${critical.length} parça life limit'i aştı (${critical.map(p => p.serialNumber).join(', ')})`);
  }
  
  if (warning.length > 0) {
    messages.push(`${warning.length} parça life limit'e yaklaşıyor (${warning.map(p => p.serialNumber).join(', ')})`);
  }
  
  return messages.join('. ');
}

