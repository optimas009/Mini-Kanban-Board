'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthField, authInputClass, AuthSubmit } from '@/components/AuthField';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, getErrorMessage } from '@/lib/api';
import type { AuthResponse } from '@/lib/types';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/boards');
  }, [isAuthenticated, isLoading, router]);

  async function onSubmit(values: RegisterForm) {
    setServerError('');

    try {
      const response = await apiFetch<AuthResponse>('/auth/register', {
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
      eyebrow="Get started"
      heading="Create account"
      footer={
        <>
          Already registered?{' '}
          <Link
            href="/login"
            className="font-semibold text-(--ink) underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField label="Name" error={errors.name?.message}>
          <input
            autoComplete="name"
            placeholder="Your name"
            className={authInputClass}
            {...register('name')}
          />
        </AuthField>

        <AuthField label="Email address" error={errors.email?.message}>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={authInputClass}
            {...register('email')}
          />
        </AuthField>

        <AuthField label="Password" error={errors.password?.message}>
          <input
            type="password"
            autoComplete="new-password"
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

        <AuthSubmit busy={isSubmitting} busyLabel="Creating account">
          Create account
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}
