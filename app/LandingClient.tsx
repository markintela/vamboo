'use client';

import Link from 'next/link';
import { Map, Wallet, Building2, ShieldCheck, Users, PlusCircle, MapPinned, Receipt, Lock, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Carousel } from '@/components/Carousel';
import { useLanguage } from '@/lib/i18n/context';

const FEATURE_ICONS = [Map, Wallet, Building2, ShieldCheck, Users];
const FEATURE_COLORS = ['var(--red)', 'var(--orange)', 'var(--blue)', 'var(--purple)', 'var(--teal-green)'];

const STEP_ICONS = [PlusCircle, MapPinned, Receipt, Lock];
const STEP_COLORS = ['var(--blue)', 'var(--purple)', 'var(--orange)', 'var(--teal-green)'];

export function LandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { t } = useLanguage();

  const features = [1, 2, 3, 4, 5].map((n) => ({
    title: t(`landing.feature${n}Title`),
    text: t(`landing.feature${n}Text`),
  }));

  const steps = [1, 2, 3, 4].map((n) => ({
    title: t(`landing.step${n}Title`),
    text: t(`landing.step${n}Text`),
  }));

  const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`landing.faq${n}Q`),
    a: t(`landing.faq${n}A`),
  }));

  return (
    <div>
      <nav className="public-nav">
        <Logo markSize={34} />
        <div className="public-nav-links">
          <a href="#features">{t('nav.features')}</a>
          <a href="#faq">{t('nav.faq')}</a>
          <a href="#sobre">{t('nav.about')}</a>
        </div>
        <div className="topbar-actions">
          <LanguageSwitcher />
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-primary">
              <LayoutDashboard size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.goToDashboard')}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline">
                <LogIn size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.login')}</span>
              </Link>
              <Link href="/cadastro" className="btn btn-primary">
                <UserPlus size={16} strokeWidth={2.25} /> <span className="btn-label">{t('nav.signup')}</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="hero">
        <h1>{t('landing.heroTitle')}</h1>
        <p className="hero-sub">{t('landing.heroSubtitle')}</p>
        <div className="hero-ctas">
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn btn-primary">{t('nav.goToDashboard')}</Link>
          ) : (
            <>
              <Link href="/cadastro" className="btn btn-primary">{t('landing.heroCtaPrimary')}</Link>
              <Link href="/login" className="btn btn-outline">{t('landing.heroCtaSecondary')}</Link>
            </>
          )}
        </div>
      </section>

      <section className="site-section" id="features">
        <div className="site-section-head">
          <h2>{t('landing.featuresTitle')}</h2>
          <p>{t('landing.featuresSubtitle')}</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <div className="feature-card" key={i}>
                <div className="feature-icon" style={{ background: FEATURE_COLORS[i] + '1a', color: FEATURE_COLORS[i] }}>
                  <Icon size={36} strokeWidth={1.6} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="site-section">
        <div className="site-section-head">
          <h2>{t('landing.carouselTitle')}</h2>
        </div>
        <Carousel
          items={steps.map((s, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <div className="step-card" key={i}>
                <div className="feature-icon" style={{ background: STEP_COLORS[i] + '1a', color: STEP_COLORS[i] }}>
                  <Icon size={32} strokeWidth={1.6} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            );
          })}
        />
      </section>

      <section className="site-section" id="sobre">
        <div className="about-mission">
          <div className="block">
            <h2>{t('landing.aboutTitle')}</h2>
            <p>{t('landing.aboutText')}</p>
          </div>
          <div className="block">
            <h2>{t('landing.missionTitle')}</h2>
            <p>{t('landing.missionText')}</p>
          </div>
        </div>
      </section>

      <section className="site-section" id="faq">
        <div className="site-section-head">
          <h2>{t('landing.faqTitle')}</h2>
        </div>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <details className="faq-item" key={i}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <Logo markSize={30} />
          </div>
          <div>
            <h4>{t('landing.footerProduct')}</h4>
            <ul>
              <li><a href="#features">{t('nav.features')}</a></li>
              <li><a href="#faq">{t('nav.faq')}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t('landing.footerCompany')}</h4>
            <ul>
              <li><a href="#sobre">{t('nav.about')}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t('landing.footerLegal')}</h4>
            <ul>
              <li><Link href="/termos">{t('landing.footerTerms')}</Link></li>
              <li><Link href="/privacidade">{t('landing.footerPrivacy')}</Link></li>
            </ul>
          </div>
        </div>
        <div className="landing-footer-bottom">
          © {new Date().getFullYear()} Vamboh. {t('landing.footerRights')}
        </div>
      </footer>
    </div>
  );
}
