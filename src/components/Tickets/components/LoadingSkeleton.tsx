import React from 'react';

interface LoadingSkeletonProps {
  type?: 'table' | 'card' | 'stats' | 'form';
  rows?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'table', 
  rows = 5 
}) => {
  const renderTableSkeleton = () => (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="animate-pulse">
        <div className="bg-gray-50 px-6 py-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="px-6 py-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCardSkeleton = () => (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded"></div>
          <div className="h-3 bg-gray-100 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  );

  const renderStatsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
          <div className="animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-gray-300 rounded w-1/3"></div>
              </div>
              <div className="h-8 w-8 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderFormSkeleton = () => (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="animate-pulse space-y-4">
        <div>
          <div className="h-3 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-100 rounded"></div>
        </div>
        <div className="h-10 bg-gray-300 rounded"></div>
      </div>
    </div>
  );

  switch (type) {
    case 'card':
      return renderCardSkeleton();
    case 'stats':
      return renderStatsSkeleton();
    case 'form':
      return renderFormSkeleton();
    default:
      return renderTableSkeleton();
  }
};

export default LoadingSkeleton;