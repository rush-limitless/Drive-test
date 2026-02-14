import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Headset,
  Linkedin,
  MessageCircle,
  Mic,
  Moon,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Rocket,
  Send,
  ShieldCheck,
  Smartphone,
  Sun,
  Workflow,
  Zap,
  Youtube,
  X,
} from 'lucide-react';
import './Presentation.css';
import p2sLogo from '../assets/presentation/p2s-logo.png';
import dashboardMockup from '../assets/presentation/dashboard.png';
import modulesMockup from '../assets/presentation/modules.png';
import workflowsMockup from '../assets/presentation/workflows.png';
import devicesMockup from '../assets/presentation/devices.png';

type DemoScene = {
  title: string;
  caption: string;
  outcome: string;
  duration: string;
  image: string;
};

type ThemeMode = 'light' | 'dark';
type ProductFeature = { title: string; description: string; icon: React.ComponentType<{ size?: number }> };
type HowItWorksStep = {
  step: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
};
type UseCaseCard = {
  title: string;
  description: string;
  bullets: string[];
  icon: React.ComponentType<{ size?: number }>;
};

const DEMO_SCENES: DemoScene[] = [
  {
    title: 'Dashboard',
    caption: 'See connected devices, quick actions, and live activity.',
    outcome: 'Start tests with full context.',
    duration: '00:00 - 00:07',
    image: dashboardMockup,
  },
  {
    title: 'Modules',
    caption: 'Execute ready-to-run telecom actions.',
    outcome: 'Reduce repetitive manual steps.',
    duration: '00:07 - 00:14',
    image: modulesMockup,
  },
  {
    title: 'Workflows',
    caption: 'Chain modules into repeatable flows.',
    outcome: 'Standardize campaign execution.',
    duration: '00:14 - 00:21',
    image: workflowsMockup,
  },
  {
    title: 'Device Manager',
    caption: 'Scan, filter, and track device history.',
    outcome: 'Keep fleet status clear.',
    duration: '00:21 - 00:28',
    image: devicesMockup,
  },
];

const PRODUCT_FEATURES: ProductFeature[] = [
  {
    title: 'Smart Modules',
    description: 'Voice, SMS, data, and network checks ready to run in two clicks.',
    icon: Zap,
  },
  {
    title: 'Multi-Device Orchestration',
    description: 'Run synchronized campaigns across multiple Android devices from one control layer.',
    icon: Smartphone,
  },
  {
    title: 'Visual Workflows',
    description: 'Build repeatable test scenarios with clear visual logic and no heavy scripting.',
    icon: Workflow,
  },
  {
    title: 'Guaranteed Reliability',
    description: 'Built-in retries and execution guards keep campaigns stable from lab to release.',
    icon: ShieldCheck,
  },
  {
    title: 'Professional Reports',
    description: 'Export concise test evidence and summaries for QA, operations, and management.',
    icon: FileText,
  },
  {
    title: 'Fast Setup',
    description: 'Start your first campaigns in minutes with a lightweight onboarding flow.',
    icon: Rocket,
  },
];

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: '01',
    title: 'Connect Devices',
    description: 'Plug Android phones, enable ADB, and confirm live status in MOBIQ.',
    icon: Smartphone,
  },
  {
    step: '02',
    title: 'Choose Modules',
    description: 'Pick ready telecom checks and combine actions for your campaign scope.',
    icon: Workflow,
  },
  {
    step: '03',
    title: 'Run Campaign',
    description: 'Execute workflows in sequence with clear progress and control.',
    icon: PlayCircle,
  },
  {
    step: '04',
    title: 'Analyze & Export',
    description: 'Review outcomes and export concise evidence for QA and operations.',
    icon: FileText,
  },
];

const USE_CASES: UseCaseCard[] = [
  {
    title: 'RF Engineers',
    description: 'Drive test execution and network validation with structured evidence.',
    bullets: [
      'Real-time device status monitoring',
      'Repeatable module execution',
      'Workflow-based campaign control',
      'Clear traceability by run',
    ],
    icon: Smartphone,
  },
  {
    title: 'Telecom Operations',
    description: 'Stabilize field and lab operations through one reliable control center.',
    bullets: [
      'Standardized execution playbooks',
      'Faster troubleshooting loops',
      'Consistent run history visibility',
      'Cross-team campaign coordination',
    ],
    icon: Workflow,
  },
  {
    title: 'QA Teams',
    description: 'Increase release confidence with consistent checks and exportable proof.',
    bullets: [
      'Reusable validation scenarios',
      'Execution outcome tracking',
      'Issue reproduction support',
      'Report-ready evidence export',
    ],
    icon: FileText,
  },
  {
    title: 'Device Programs',
    description: 'Support device certification and onboarding with repeatable telecom tests.',
    bullets: [
      'Multi-device test coverage',
      'Stable execution guardrails',
      'Rapid campaign rollout',
      'Operational visibility for stakeholders',
    ],
    icon: ShieldCheck,
  },
];

const FAQ = [
  {
    q: 'How quickly can a team start using MOBIQ?',
    a: 'Connect devices, run a module, then launch a workflow.',
  },
  {
    q: 'Does MOBIQ work for both lab and field validation?',
    a: 'Yes. It supports repeatable QA and day-to-day telecom operations.',
  },
  {
    q: 'How do we prove execution quality to stakeholders?',
    a: 'Runs keep status and timeline data for quick reviews.',
  },
];

const FOOTER_PLATFORM_LINKS = [
  { label: 'Solution', href: '#story' },
  { label: 'Capabilities', href: '#why' },
  { label: "Who It's For", href: '#why' },
  { label: 'Request Demo', href: '#request-demo' },
];

const FOOTER_COMPANY_LINKS = [
  { label: 'About Us', href: '#why' },
  { label: 'Contact', href: '#request-demo' },
  { label: 'Support', href: '#faq' },
  { label: 'Documentation', href: '#faq' },
];

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: 'easeOut' as const, delay },
});

const DEMO_VIDEO_SRC = '/1.mp4';
const DEMO_VIDEO_FALLBACK_SRC = '/watch-demo.mp4';
const GET_STARTED_URL = 'http://www.f2gsolutions.com/';

const getInitialTheme = (): ThemeMode => {
  return 'light';
};

const Presentation: React.FC = () => {
  const navigate = useNavigate();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [demoVideoOpen, setDemoVideoOpen] = useState(false);
  const [requestRole, setRequestRole] = useState('');
  const [requestNeeds, setRequestNeeds] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [frameTilt, setFrameTilt] = useState({ x: 0, y: 0 });
  const demoVideoRef = useRef<HTMLVideoElement | null>(null);

  const handleGetStarted = () => {
    window.location.href = GET_STARTED_URL;
  };

  useEffect(() => {
    if (!isPlaying) return undefined;

    const interval = window.setInterval(() => {
      setSceneIndex((prev) => (prev + 1) % DEMO_SCENES.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    window.localStorage.setItem('mobiq-presentation-theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (!demoVideoOpen) return;

    const video = demoVideoRef.current;
    if (!video) return;

    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Ignore blocked autoplay; controls stay available for manual play.
      });
    }
  }, [demoVideoOpen]);

  const onFrameMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setFrameTilt({
      x: py * -6,
      y: px * 8,
    });
  };

  const resetFrameTilt = () => setFrameTilt({ x: 0, y: 0 });

  const activeScene = DEMO_SCENES[sceneIndex];

  return (
    <div className={`presentation-page theme-${themeMode}`}>
      <div className="presentation-grid" />

      <header className="topbar container">
        <div className="brand-group">
          <img className="brand-logo" src={p2sLogo} alt="MOBIQ logo" />
          <div>
            <p className="brand-name">MOBIQ</p>
            <p className="brand-tag">Developed by F2G Solutions - Far Together</p>
          </div>
        </div>

        <nav className="topnav">
          <a href="#story">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#faq">FAQ</a>
          <a href="#request-demo">Contact</a>
        </nav>

        <div className="topbar-actions">
          <button
            className="theme-toggle"
            onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
            aria-label={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} mode`}
          >
            {themeMode === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <button className="btn btn-outline" onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
      </header>

      <main className="container page-canvas">
        <section className="hero-block">
          <motion.div className="hero-copy" {...fadeIn(0)}>
            <h1>
              <span className="hero-title-main">Professional Telecom Test Automation</span>
              <span className="hero-title-muted">Made Simple with MOBIQ</span>
            </h1>
            <p className="hero-lead">Connect devices, run modules, and execute workflows from one platform.</p>

            <div className="hero-actions">
              <button className="btn btn-dark btn-hero-primary" onClick={handleGetStarted}>
                Get Started
                <ArrowRight size={16} />
              </button>
              <button
                className="btn btn-light"
                onClick={() => {
                  setDemoVideoOpen(true);
                  setIsPlaying(false);
                }}
              >
                Watch demo
                <PlayCircle size={16} />
              </button>
            </div>

          </motion.div>

          <motion.div className="hero-visual" {...fadeIn(0.08)}>
            <div className="aura" />

            <motion.div
              className="screen-stage"
              onMouseMove={onFrameMove}
              onMouseLeave={resetFrameTilt}
              animate={{ rotateX: frameTilt.x, rotateY: frameTilt.y }}
              whileHover={{ y: -5, scale: 1.005 }}
              transition={{ type: 'spring', stiffness: 160, damping: 22, mass: 0.6 }}
            >
              <div className="screen-frame demo-frame">
                <div className="demo-topbar">
                  <div className="demo-pills">
                    <span className="dot red" />
                    <span className="dot yellow" />
                    <span className="dot green" />
                    <span className="demo-tag">Live product walkthrough</span>
                  </div>
                  <div className="demo-meta">
                    <span>{activeScene.duration}</span>
                    <button onClick={() => setIsPlaying((prev) => !prev)}>
                      {isPlaying ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeScene.image}
                    className="demo-image"
                    src={activeScene.image}
                    alt="MOBIQ interface preview"
                    initial={{ opacity: 0, y: 12, scale: 1.02 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 1.02 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                  />
                </AnimatePresence>

                <div className="demo-overlay">
                  <p className="demo-title">{activeScene.title}</p>
                  <p>{activeScene.caption}</p>
                  <span>{activeScene.outcome}</span>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </section>

        <section id="story" className="section story-section">
          <div className="story-shell">
            <motion.p className="section-eyebrow" {...fadeIn(0)}>
              FEATURES & BENEFITS
            </motion.p>
            <motion.h2 {...fadeIn(0.04)}>Everything you need for professional telecom test automation.</motion.h2>
            <motion.p className="section-sub story-sub" {...fadeIn(0.06)}>
              From device connection to report export, MOBIQ brings essential telecom execution tools into one clear
              and structured workspace.
            </motion.p>

            <div className="product-grid">
              {PRODUCT_FEATURES.map((item, index) => (
                <motion.article key={item.title} className="product-card" {...fadeIn(0.08 + index * 0.02)}>
                  <span className="product-icon">
                    <item.icon size={17} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="section how-section">
          <div className="how-shell">
            <motion.p className="section-eyebrow" {...fadeIn(0)}>
              HOW IT WORKS
            </motion.p>
            <motion.h2 {...fadeIn(0.04)}>Get started in four simple steps</motion.h2>
            <motion.p className="section-sub how-sub" {...fadeIn(0.06)}>
              From setup to delivery, MOBIQ is designed for fast execution and clear outcomes.
            </motion.p>
            <div className="how-grid">
              {HOW_IT_WORKS_STEPS.map((item, index) => (
                <motion.article key={item.title} className="how-card" {...fadeIn(0.08 + index * 0.03)}>
                  <div className="how-card-head">
                    <span className="how-step">{item.step}</span>
                    <span className="how-icon">
                      <item.icon size={16} />
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </motion.article>
              ))}
            </div>
            <p className="how-footnote">Average setup time: under 5 minutes</p>
          </div>
        </section>

        <section id="why" className="section usecases-section">
          <span id="use-cases" className="anchor-offset" aria-hidden="true" />
          <motion.p className="section-eyebrow" {...fadeIn(0)}>
            USE CASES
          </motion.p>
          <motion.h2 {...fadeIn(0.04)}>Built for telecom professionals</motion.h2>
          <motion.p className="section-sub usecases-sub" {...fadeIn(0.06)}>
            Whether you are operating, validating, or scaling campaigns, MOBIQ adapts to your workflow.
          </motion.p>
          <div className="usecases-grid">
            {USE_CASES.map((item, index) => (
              <motion.article key={item.title} className="usecase-card" {...fadeIn(0.05 + index * 0.04)}>
                <div className="usecase-head">
                  <span className="usecase-icon">
                    <item.icon size={16} />
                  </span>
                  <h3>{item.title}</h3>
                </div>
                <p>{item.description}</p>
                <ul>
                  {item.bullets.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="faq" className="section faq">
          <div className="faq-shell">
            <motion.p className="section-eyebrow" {...fadeIn(0)}>
              FAQ
            </motion.p>
            <motion.h2 {...fadeIn(0.04)}>Frequently Asked Questions</motion.h2>
            <motion.p className="section-sub faq-sub" {...fadeIn(0.06)}>
              Need help? <a href="#request-demo">Contact us</a>
            </motion.p>
            <div className="faq-list">
              {FAQ.map((item, index) => (
                <motion.details key={item.q} {...fadeIn(0.07 + index * 0.03)}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </motion.details>
              ))}
            </div>
          </div>
        </section>

        <section id="request-demo" className="section request-demo">
          <div className="request-grid">
            <motion.div className="request-copy" {...fadeIn(0.02)}>
              <p className="request-badge">EXPERIENCE THE FUTURE</p>
              <h2>Ready to Transform Your Mobile Testing?</h2>
              <p className="request-lead">
                Join telecom operators, QA teams, and testing companies that want faster, repeatable execution.
              </p>

              <div className="request-benefits">
                <article>
                  <span className="request-icon">
                    <CalendarDays size={18} />
                  </span>
                  <div>
                    <h3>Schedule a live demo</h3>
                    <p>See MOBIQ in action with a personalized walkthrough.</p>
                  </div>
                </article>

                <article>
                  <span className="request-icon">
                    <BriefcaseBusiness size={18} />
                  </span>
                  <div>
                    <h3>Expert consultation</h3>
                    <p>Design the right automation setup for your team.</p>
                  </div>
                </article>

                <article>
                  <span className="request-icon">
                    <Rocket size={18} />
                  </span>
                  <div>
                    <h3>Fast implementation</h3>
                    <p>Get onboarded quickly with focused guidance.</p>
                  </div>
                </article>
              </div>
            </motion.div>

            <motion.form
              className="request-form-card"
              {...fadeIn(0.1)}
              onSubmit={(event) => {
                event.preventDefault();
                setRequestSent(true);
              }}
            >
              <h3>Request Your Demo</h3>

              <label htmlFor="request-full-name">Full Name *</label>
              <input id="request-full-name" name="fullName" type="text" placeholder="John Smith" required />

              <label htmlFor="request-email">Email Address *</label>
              <input id="request-email" name="email" type="email" placeholder="john@company.com" required />

              <label htmlFor="request-company">Company Name *</label>
              <input id="request-company" name="company" type="text" placeholder="Your Company" required />

              <label htmlFor="request-role">Your Role *</label>
              <select
                id="request-role"
                name="role"
                value={requestRole}
                onChange={(event) => setRequestRole(event.target.value)}
                required
              >
                <option value="">Select your role</option>
                <option value="qa">QA Engineer</option>
                <option value="manager">Test Manager</option>
                <option value="ops">Operations Lead</option>
                <option value="product">Product Owner</option>
                <option value="other">Other</option>
              </select>

              <label htmlFor="request-needs">Tell Us About Your Testing Needs</label>
              <textarea
                id="request-needs"
                name="needs"
                value={requestNeeds}
                onChange={(event) => setRequestNeeds(event.target.value.slice(0, 500))}
                placeholder="Describe your current testing challenges and what you'd like to achieve with MOBIQ..."
              />
              <p className="request-char-count">{requestNeeds.length}/500 characters</p>

              <button type="submit" className="request-submit">
                Request Demo
              </button>

              {requestSent && <p className="request-success">Thanks, your request is ready to be reviewed.</p>}
            </motion.form>
          </div>
        </section>

      </main>

      <footer className="presentation-footer">
        <div className="container footer-inner">
          <div className="footer-top">
            <div className="footer-brand-block">
              <img className="footer-logo" src={p2sLogo} alt="MOBIQ footer logo" />
              <p>
                Transforming mobile network testing with intelligent, centralized automation.
                <br />
                Free your engineers from repetition and empower them to innovate.
              </p>
              <div className="footer-socials" aria-label="Social links">
                <a href="#" aria-label="MOBIQ on LinkedIn">
                  <Linkedin size={16} />
                </a>
                <a href="#" aria-label="MOBIQ on X">
                  <span>X</span>
                </a>
                <a href="#" aria-label="MOBIQ on YouTube">
                  <Youtube size={16} />
                </a>
              </div>
            </div>

            <div className="footer-links-block">
              <div>
                <h3>Platform</h3>
                <ul>
                  {FOOTER_PLATFORM_LINKS.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3>Company</h3>
                <ul>
                  {FOOTER_COMPANY_LINKS.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2026 MOBIQ. All rights reserved.</p>
            <div className="footer-legal">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Powered by F2G Solutions</a>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {demoVideoOpen && (
          <motion.div
            className="demo-video-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDemoVideoOpen(false)}
          >
            <motion.div
              className="demo-video-panel"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="demo-video-header">
                <p>Watch demo</p>
                <button aria-label="Close demo video" onClick={() => setDemoVideoOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <video ref={demoVideoRef} className="demo-video-player" controls autoPlay playsInline preload="auto">
                <source src={DEMO_VIDEO_SRC} type="video/mp4" />
                <source src={DEMO_VIDEO_FALLBACK_SRC} type="video/mp4" />
              </video>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mobile-sticky-cta" aria-label="Quick actions">
        <button className="btn btn-dark" onClick={() => navigate('/dashboard')}>
          Open dashboard
        </button>
        <button className="btn btn-light" onClick={() => navigate('/workflows')}>
          Workflows
        </button>
      </div>

      <div className="talk-widget" aria-label="Talk with us assistant">
        <AnimatePresence>
          {chatbotOpen && (
            <motion.div
              className="talk-panel"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <div className="talk-header">
                <div className="talk-headline">
                  <div className="talk-headset">
                    <Headset size={31} />
                  </div>
                  <div>
                    <p className="talk-title">Talk with Us</p>
                    <p className="talk-subtitle">Choose voice or text</p>
                  </div>
                </div>

                <div className="talk-header-actions">
                  <button onClick={() => setChatInput('')} aria-label="Reset message">
                    <RefreshCw size={16} />
                  </button>
                  <button onClick={() => setChatbotOpen(false)} aria-label="Close chat">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="talk-body">
                <div className="talk-body-icon">
                  <MessageCircle size={34} />
                </div>
                <p>Use voice or text to communicate</p>
              </div>

              <form className="talk-composer" onSubmit={(event) => event.preventDefault()}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type your message..."
                  aria-label="Type your message"
                />
                <button type="button" className="talk-send" aria-label="Send message">
                  <Send size={18} />
                </button>
                <button type="button" className="talk-mic" aria-label="Voice input">
                  <Mic size={18} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button className="talk-trigger" onClick={() => setChatbotOpen((prev) => !prev)}>
          <Headset size={22} />
          <span>Talk with Us</span>
        </button>
      </div>
    </div>
  );
};

export default Presentation;
