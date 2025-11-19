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

/**
 * Flattens component tree into a single array
 * @param components - Component tree to flatten
 * @returns Flat array of all components
 */
export function flattenComponents(components: Component[]): Component[] {
  const result: Component[] = [];
  
  function traverse(comps: Component[]) {
    comps.forEach(comp => {
      result.push(comp);
      if (comp.children && comp.children.length > 0) {
        traverse(comp.children);
      }
    });
  }
  
  traverse(components);
  return result;
}

/**
 * Finds a component by ID in the component tree
 * @param components - Component tree to search
 * @param id - Component ID to find
 * @returns Component if found, undefined otherwise
 */
export function findComponentById(components: Component[], id: number): Component | undefined {
  for (const comp of components) {
    if (comp.id === id) return comp;
    if (comp.children) {
      const found = findComponentById(comp.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Removes a component from the component tree
 * @param components - Component tree
 * @param id - Component ID to remove
 * @returns Updated component tree without the specified component
 */
export function removeComponentById(components: Component[], id: number): Component[] {
  return components.filter(comp => {
    if (comp.id === id) return false;
    if (comp.children) {
      comp.children = removeComponentById(comp.children, id);
    }
    return true;
  });
}

/**
 * Replaces a component in the tree by ID
 * @param components - Component tree
 * @param removeId - ID of component to remove
 * @param newComponent - New component to insert in its place
 * @returns Updated component tree
 */
export function replaceComponentInTree(
  components: Component[],
  removeId: number,
  newComponent: Component
): Component[] {
  return components.map(comp => {
    if (comp.id === removeId) {
      return newComponent;
    }
    if (comp.children) {
      return {
        ...comp,
        children: replaceComponentInTree(comp.children, removeId, newComponent)
      };
    }
    return comp;
  });
}

/**
 * Finds all components in an assembly group
 * @param components - Component tree
 * @param assemblyGroupName - Name of the assembly group
 * @returns Array of components in the assembly group
 */
export function findComponentsByAssemblyGroup(
  components: Component[],
  assemblyGroupName: string
): Component[] {
  const result: Component[] = [];
  
  function traverse(comps: Component[], parentMatches: boolean = false) {
    comps.forEach(comp => {
      // Check if this is the assembly group root
      const isGroupRoot = comp.description === assemblyGroupName;
      
      // If parent matches or this is the group root, include this component
      if (parentMatches || isGroupRoot) {
        result.push(comp);
      }
      
      // Continue traversing children
      if (comp.children && comp.children.length > 0) {
        traverse(comp.children, parentMatches || isGroupRoot);
      }
    });
  }
  
  traverse(components);
  return result;
}

/**
 * Removes an entire assembly group from the component tree
 * @param components - Component tree
 * @param assemblyGroupName - Name of the assembly group to remove
 * @returns Updated component tree without the assembly group
 */
export function removeAssemblyGroup(
  components: Component[],
  assemblyGroupName: string
): Component[] {
  return components.filter(comp => {
    // If this is the assembly group root, remove it
    if (comp.description === assemblyGroupName) {
      return false;
    }
    
    // Recursively filter children
    if (comp.children) {
      comp.children = removeAssemblyGroup(comp.children, assemblyGroupName);
    }
    
    return true;
  });
}

/**
 * Syncs component hours with engine total hours
 * @param components - Components to sync
 * @param engineTotalHours - Current engine total hours
 * @returns Updated components with synced hours
 */
export function syncComponentHours(
  components: Component[],
  engineTotalHours: number
): Component[] {
  return components.map(comp => ({
    ...comp,
    currentHours: engineTotalHours,
    children: comp.children 
      ? syncComponentHours(comp.children, engineTotalHours)
      : undefined
  }));
}

