'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { BoardLoading } from '@/components/BoardLoading';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) router.replace(isAuthenticated ? '/boards' : '/login');
  }, [isAuthenticated, isLoading, router]);

  return <BoardLoading label="Loading" />;
}
