'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import PlatformHeader from '@/components/PlatformHeader';

export default function AuthPage() {
  const [isLoginState, setIsLoginState] = useState(true);
  const [formData, setFormData] = useState({ 
    name: '',       // Full Legal Name
    handle: '',     // Stage Name or Label Name
    email: '', 
    phone: '',      // Phone Number
    password: '' 
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Frontend guard: Validate terms acceptance on signup only
    if (!isLoginState && !agreedToTerms) {
      setErrorMsg('You must warrant ownership of your audio and agree to the terms to create an account.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isLoginState ? 'login' : 'signup',
          ...formData,
          agreedToTerms: !isLoginState ? agreedToTerms : true
        }),
      });

      const result = await response.json();

      if (result.success) {
        // 1. SIGN-UP PATH: If a Stripe onboarding URL was returned, redirect straight to Stripe. Zero dashboard involvement.
        if (result.url) {
          window.location.href = result.url;
          return;
        }

        // 2. LOGIN PATH: Handle session storage and route to the dashboard
        if (result.session) {
          await supabase.auth.setSession(result.session);
        }
        
        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else {
          router.push('/dashboard');
        }
      } else {
        setErrorMsg(result.message || 'Authentication failed');
      }
    } catch (err) {
      setErrorMsg('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.pageWrapper}>
      {/* Platform Header without upgrade button */}
      <PlatformHeader userTier="" />

      {/* Main Auth Form Container */}
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.header}>
            <h2 style={styles.title}>{isLoginState ? 'Welcome Back' : 'Create Free Account'}</h2>
            <p style={styles.subtitle}>{isLoginState ? 'Log in to manage your catalog.' : 'Join to manage and distribute your music.'}</p>
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

            {/* Legal Liability & Copyright Warranty Checkbox (Sign Up Only) */}
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
                  I warrant that I own 100% of the rights or hold explicit, valid licenses (including beat leases/exclusive rights and sample clearances) for all audio uploaded. I agree to indemnify and hold harmless <span style={{ color: '#fff', fontWeight: '500' }}>2G Entertainment</span> and <span style={{ color: '#fff', fontWeight: '500' }}>Music Market</span> from any copyright infringement claims, damages, or liabilities.
                </label>
              </div>
            )}

            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Processing...' : (isLoginState ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div style={styles.switchPrompt}>
            <span>{isLoginState ? "Don't have an account?" : "Already have an account?"}</span>
            <button 
              type="button" 
              onClick={() => { setIsLoginState(!isLoginState); setErrorMsg(''); setAgreedToTerms(false); }}
              style={styles.toggleBtn}
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
  label: { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#aaa', marginBottom: '0.5rem' },
  input: { width: '100%', background: '#111', border: '1px solid #2e2e2e', borderRadius: '10px', padding: '0.85rem 1rem', color: '#fff', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' },
  legalGroup: { display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '1.25rem', textAlign: 'left' },
  checkbox: { marginTop: '2px', width: '16px', height: '16px', accentColor: '#ff8c00', cursor: 'pointer', flexShrink: 0 },
  legalText: { fontSize: '11px', color: '#888', lineHeight: '1.4', cursor: 'pointer' },
  submitBtn: { width: '100%', padding: '0.85rem', background: '#ff8c00', color: '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', marginTop: '0.75rem', transition: 'background 0.2s' },
  switchPrompt: { marginTop: '1.75rem', textAlign: 'center', fontSize: '13px', color: '#888' },
  toggleBtn: { background: 'none', border: 'none', color: '#ff8c00', fontWeight: 'bold', cursor: 'pointer', marginLeft: '0.35rem' },
  errorBanner: { padding: '0.75rem', background: '#3a1a1a', border: '1px solid rgba(231,76,60,0.4)', color: '#e74c3c', borderRadius: '10px', marginBottom: '1.25rem', fontSize: '12px', textAlign: 'center' }
};
