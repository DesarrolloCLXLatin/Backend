// hooks/useViewPermissions.ts
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ViewConfig {
  sections: Record<string, any>;
  limits?: Record<string, any>;
  features?: Record<string, any>;
}

export const useViewPermissions = (viewName: string) => {
  const { user } = useAuth();
  const [config, setConfig] = useState<ViewConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadViewConfig();
    }
  }, [user?.id, viewName]);

  const loadViewConfig = async () => {
    try {
      const response = await fetch(`/api/rbac/views/${viewName}/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Error loading view config:', error);
    } finally {
      setLoading(false);
    }
  };

  const canAccessSection = useCallback((sectionName: string) => {
    if (!config?.sections?.[sectionName]) return false;
    return config.sections[sectionName].visible === true;
  }, [config]);

  const canPerformAction = useCallback((section: string, action: string) => {
    if (!config?.sections?.[section]?.actions) return false;
    return config.sections[section].actions[action] === true;
  }, [config]);

  const getVisibleColumns = useCallback((section: string) => {
    const columns = config?.sections?.[section]?.columns;
    if (!columns) return [];
    return columns.includes('all') ? '*' : columns;
  }, [config]);

  const getLimit = useCallback((limitType: string) => {
    if (!config?.limits?.[limitType]) return -1;
    return config.limits[limitType];
  }, [config]);

  const hasFeature = useCallback((feature: string) => {
    if (!config?.features?.[feature]) return false;
    return config.features[feature] === true;
  }, [config]);

  return {
    config,
    loading,
    canAccessSection,
    canPerformAction,
    getVisibleColumns,
    getLimit,
    hasFeature,
    refresh: loadViewConfig
  };
};