'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthLayout } from '@/components/AuthLayout';
import { AuthField, authInputClass, AuthSubmit } from '@/components/AuthField';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, getErrorMessage } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/boards');
  }, [isAuthenticated, isLoading, router]);

  async function onSubmit(values: LoginForm) {
    setServerError('');

    try {
      const response = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });

      login(response.user, response.accessToken);
      router.replace('/boards');
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      heading="Sign in"
      footer={
        <>
          New here?{' '}
          <Link
            href="/register"
            className="font-semibold text-(--ink) underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField label="Email address" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={authInputClass}
            {...register('email')}
          />
        </AuthField>

        <AuthField label="Password" error={errors.password?.message}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="At least 8 characters"
            className={authInputClass}
            {...register('password')}
          />
        </AuthField>

        {serverError && (
          <p
            className="border border-(--alert)/30 bg-(--alert-tint) px-3 py-2.5 text-sm text-(--alert)"
            style={{ borderRadius: 3 }}
            role="alert"
          >
            {serverError}
          </p>
        )}

        <AuthSubmit busy={isSubmitting} busyLabel="Signing in">
          Sign in
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}
