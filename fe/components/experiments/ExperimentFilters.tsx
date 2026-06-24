'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { ExperimentFilters as FilterType, ExperimentStatus, TaskType } from '@/types/experiment';

interface ExperimentFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export function ExperimentFilters({ filters, onFiltersChange }: ExperimentFiltersProps) {
  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value === 'all' ? undefined : (value as ExperimentStatus),
    });
  };

  const handleTaskTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      task_type: value === 'all' ? undefined : (value as TaskType),
    });
  };

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      search: value || undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = filters.status || filters.task_type || filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Status Filter */}
      <Select
        value={filters.status || 'all'}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-full sm:w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      {/* Task Type Filter */}
      <Select
        value={filters.task_type || 'all'}
        onValueChange={handleTaskTypeChange}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Task Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Task Types</SelectItem>
          <SelectItem value="classification">Classification</SelectItem>
          <SelectItem value="regression">Regression</SelectItem>
          <SelectItem value="timeseries">Time Series</SelectItem>
        </SelectContent>
      </Select>

      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search experiments..."
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="shrink-0"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
