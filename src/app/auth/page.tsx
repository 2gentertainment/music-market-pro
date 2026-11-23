'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import PlatformHeader from '@/components/PlatformHeader';

export default function AuthPage() {
  const [isLoginState, setIsLoginState] = useState(true);
  const [formData, setFormData] = useState({
    name: '',            // Full Legal Name
    handle: '',          // Stage Name or Label Name
    email: '',
    phone: '',           // Phone Number
    password: '',
    confirmPassword: '', // Sign-up password verification
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const generateSlug = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const checkHandleAndNameAvailable = async (rawName: string) => {
    const trimmed = rawName.trim();
    const slug = generateSlug(trimmed);
    if (!trimmed || !slug) {
      return { available: false, message: 'Please enter a valid artist stage name or label name.' };
    }

    const { data: handleMatches } = await supabase
      .from('profiles')
      .select('id')
      .or(`handle.eq.${slug},artist_handle.eq.${slug}`)
      .limit(1);

    if (handleMatches && handleMatches.length > 0) {
      return {
        available: false,
        message: `The handle "${slug}" is already taken. Please choose a different stage or label name.`,
      };
    }

    const { data: nameMatches } = await supabase
      .from('profiles')
      .select('id')
      .or(`stage_name.ilike.${trimmed},label_name.ilike.${trimmed}`)
      .limit(1);

    if (nameMatches && nameMatches.length > 0) {
      return {
        available: false,
        message: `"${trimmed}" is already registered as an artist stage name or label name.`,
      };
    }

    return { available: true, slug };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isLoginState) {
      if (formData.password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setErrorMsg('Passwords do not match. Please verify both password boxes.');
        return;
      }

      if (!agreedToTerms) {
        setErrorMsg('You must warrant ownership of your audio and agree to the terms to create an account.');
        return;
      }
    }

    setLoading(true);

    try {
      if (!isLoginState) {
        const availability = await checkHandleAndNameAvailable(formData.handle);
        if (!availability.available) {
          setErrorMsg(availability.message || 'That stage name or handle is already taken.');
          setLoading(false);
          return;
        }
      }

      const cleanHandle = !isLoginState ? generateSlug(formData.handle) : undefined;

      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLoginState ? 'login' : 'signup',
          name: formData.name,
          handle: !isLoginState ? cleanHandle : undefined,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          stageName: !isLoginState ? formData.handle.trim() : undefined,
          agreedToTerms: !isLoginState ? agreedToTerms : true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.url) {
          window.location.href = result.url;
          return;
        }

        if (result.session) {
          const { error: sessionErr } = await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
          if (sessionErr) {
            setErrorMsg(sessionErr.message || 'Failed to establish session.');
            return;
          }
        }

        router.replace(result.redirectTo || '/dashboard');
      } else {
        setErrorMsg(result.message || 'Authentication failed');
      }
    } catch (err) {
      setErrorMsg('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordsMismatch =
    !isLoginState &&
    formData.confirmPassword.length > 0 &&
    formData.password !== formData.confirmPassword;

  return (
    <div style={styles.pageWrapper} className="touch-manipulation">
      <PlatformHeader userTier="" />

      <div style={styles.wrapper} className="touch-manipulation">
        <div style={styles.card} className="touch-manipulation">
          <div style={styles.header}>
            <h2 style={styles.title}>{isLoginState ? 'Welcome Back' : 'Create Free Account'}</h2>
            <p style={styles.subtitle}>
              {isLoginState ? 'Log in to manage your catalog.' : 'Join to manage and distribute your music.'}
            </p>
          </div>

          {errorMsg && <div style={styles.errorBanner}>{errorMsg}</div>}

          <form onSubmit={handleSubmit}>
            {!isLoginState && (
              <>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Full Legal Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Johnathan Michael Doe"
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Artist Stage Name</label>
                  <input
                    type="text"
                    name="handle"
                    value={formData.handle}
                    onChange={handleInputChange}
                    placeholder="e.g. Jair Tha PopStar"
                    style={styles.input}
                    required
                  />
                  {formData.handle.trim() && (
                    <span style={styles.slugHint}>
                      Handle slug: <strong style={{ color: '#ff8c00' }}>{generateSlug(formData.handle)}</strong>
                    </span>
                  )}
                </div>
              </>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="artist@domain.com"
                style={styles.input}
                required
              />
            </div>

            {!isLoginState && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 000-0000"
                  style={styles.input}
                  required
                />
              </div>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                style={styles.input}
                required
              />
            </div>

            {!isLoginState && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Verify Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  style={{
                    ...styles.input,
                    borderColor: passwordsMismatch ? '#ef4444' : '#2e2e2e',
                  }}
                  required
                />
                {passwordsMismatch && (
                  <span style={styles.mismatchText}>Passwords do not match yet.</span>
                )}
              </div>
            )}

            {!isLoginState && (
              <div style={styles.legalGroup}>
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  style={styles.checkbox}
                />
                <label htmlFor="termsCheckbox" style={styles.legalText}>
                  I warrant that I own 100% of the rights or hold explicit, valid licenses (including beat leases/exclusive rights and sample clearances) for all audio uploaded. I agree to indemnify and hold harmless{' '}
                  <span style={{ color: '#fff', fontWeight: '500' }}>2G Entertainment</span> and{' '}
                  <span style={{ color: '#fff', fontWeight: '500' }}>Music Market</span> from any copyright infringement claims, damages, or liabilities.
                </label>
              </div>
            )}

            <button type="submit" style={styles.submitBtn} className="touch-manipulation" disabled={loading}>
              {loading ? 'Processing...' : isLoginState ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={styles.switchPrompt}>
            <span>{isLoginState ? "Don't have an account?" : 'Already have an account?'}</span>
            <button
              type="button"
              onClick={() => {
                setIsLoginState(!isLoginState);
                setErrorMsg('');
                setAgreedToTerms(false);
                setFormData((prev) => ({ ...prev, confirmPassword: '' }));
              }}
              style={styles.toggleBtn}
              className="touch-manipulation"
            >
              {isLoginState ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  pageWrapper: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#121212', color: '#fff' },
  wrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '2rem' },
  card: { width: '100%', maxWidth: '440px', background: '#161616', border: '1px solid #2e2e2e', borderRadius: '16px', padding: '2.5rem', color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' },
  header: { marginBottom: '1.75rem', textAlign: 'center' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '0.35rem' },
  subtitle: { fontSize: '13px', color: '#888' },
  inputGroup: { marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', textAlign: 'left' },
  label: { display: 'block', fontSize: '12px', color: '#aaa', fontWeight: 'bold', marginBottom: '0.4rem' },
  input: { width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '14px', color: '#fff', outline: 'none', boxSizing: 'border-box' },
  slugHint: { fontSize: '11px', color: '#888', marginTop: '0.35rem' },
  mismatchText: { fontSize: '11px', color: '#f87171', marginTop: '0.35rem' },
  errorBanner: { background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '12px', marginBottom: '1.25rem' },
  legalGroup: { display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginBottom: '1.25rem', textAlign: 'left' },
  checkbox: { marginTop: '0.2rem', accentColor: '#ff8c00', cursor: 'pointer', flexShrink: 0 },
  legalText: { fontSize: '11px', color: '#888', lineHeight: 1.5, cursor: 'pointer' },
  submitBtn: { width: '100%', background: '#ff8c00', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '10px', padding: '0.85rem', fontSize: '14px', cursor: 'pointer' },
  switchPrompt: { marginTop: '1.5rem', textAlign: 'center', fontSize: '12px', color: '#888', display: 'flex', justifyContent: 'center', gap: '0.4rem' },
  toggleBtn: { background: 'none', border: 'none', color: '#ff8c00', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', padding: 0 },
};
