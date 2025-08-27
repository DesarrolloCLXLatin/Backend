import { useState, useCallback } from 'react';

interface UsePaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  initialPage?: number;
}

export const usePagination = ({
  totalItems,
  itemsPerPage = 50,
  initialPage = 1
}: UsePaginationProps) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(itemsPerPage);

  const totalPages = Math.ceil(totalItems / perPage);

  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const setItemsPerPage = useCallback((items: number) => {
    setPerPage(items);
    setCurrentPage(1); // Reset to first page when changing items per page
  }, []);

  const getPaginatedItems = useCallback(<T,>(items: T[]): T[] => {
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    return items.slice(start, end);
  }, [currentPage, perPage]);

  return {
    currentPage,
    perPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    setItemsPerPage,
    getPaginatedItems,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};