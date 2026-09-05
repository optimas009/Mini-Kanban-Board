export const COLUMN_COLORS = [
  'navy',
  'blue',
  'red',
  'yellow',
  'purple',
  'cyan',
  'green',
  'slate',
] as const;

export type ColumnColor = (typeof COLUMN_COLORS)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: User;
  _count: {
    members: number;
    columns: number;
  };
}

export interface BoardMember {
  createdAt: string;
  user: User;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  position: number;
  columnId: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: ColumnColor;
  position: number;
  createdAt: string;
  updatedAt: string;
  tasks: KanbanTask[];
}

export interface BoardDetail {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: User;
  members: BoardMember[];
  columns: KanbanColumn[];
}
