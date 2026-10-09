import BrandLogo from './BrandLogo.jsx';
import { PolicyLinks } from './AccountPages.jsx';
import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  PawPrint,
  ShieldPlus,
  Syringe,
  CalendarDays,
  ClipboardPlus,
  Check,
  Heart,
  Menu,
  X,
  ChevronDown,
  Scissors,
  Bell,
  Mail,
} from 'lucide-react';
import './styles.css';

const services = [
  {
    icon: Syringe,
    color: 'peach',
    title: 'Vaccinations',
    text: 'Keep their vaccine history together and know when the next dose is due.',
    detail: 'A little protection. A lot of peace of mind.',
  },
  {
    icon: ClipboardPlus,
    color: 'blue',
    title: 'Medical records',
    text: 'Give vet visits, treatments, and important health notes a place to call home.',
    detail: 'Their whole health story, in one place.',
  },
  {
    icon: CalendarDays,
    color: 'green',
    title: 'Schedules & reminders',
    text: 'Stay on top of vet visits, grooming appointments, and everyday care reminders.',
    detail: 'Good habits for happy, healthy dogs.',
  },
  {
    icon: ShieldPlus,
    color: 'yellow',
    title: 'Emergency vault',
    text: 'Keep essential information and emergency contacts close when they matter most.',
    detail: 'The right details, right when you need them.',
  },
];

function Logo() {
  return (
    <a className="logo" href="#home" aria-label="Pawfolio home">
      <BrandLogo />
    </a>
  );
}

function PetPortrait({ className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`pet-portrait ${className}`}>
      {failed ? (
        <PawPrint aria-label="Dog portrait" />
      ) : (
        <img
          src="/golden-retriever.jpg"
          alt="A golden retriever enjoying the outdoors"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export function Landing({ onAccount, user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const setAccountMode = onAccount;
  const nav = [
    { label: 'About us', href: '#about' },
    { label: 'Our services', href: '#services' },
    { label: 'Help & FAQs', href: '#help' },
  ];

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header" id="home">
        <div className="header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Main navigation">
            {[...nav, { href: '/contact', label: 'Contact us' }].map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="login-button"
              onClick={() => setAccountMode('login')}
            >
              {user ? 'Dashboard' : 'Log in'}
            </button>
            <button
              className="button compact"
              onClick={() => setAccountMode('register')}
            >
              Get started <ArrowUpRight size={16} />
            </button>
            <button
              className="menu-toggle"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            className="mobile-nav"
            id="mobile-navigation"
            aria-label="Mobile navigation"
          >
            {[...nav, { href: '/contact', label: 'Contact us' }].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
                <ArrowUpRight size={17} />
              </a>
            ))}
          </nav>
        )}
      </header>
      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="tiny-paw">
                <PawPrint size={13} />
              </span>{' '}
              MADE FOR EVERY DOG
            </span>
            <h1 id="hero-title">
              Their health.
              <br />
              Your peace
              <br />
              of <span className="coral-text">mind.</span>
              <svg
                className="headline-swoosh"
                viewBox="0 0 170 15"
                aria-hidden="true"
              >
                <path d="M3 10Q85-1 166 9M13 14Q90 5 150 11" />
              </svg>
            </h1>
            <p>
              From everyday routines to life’s little surprises. Keep your dog’s
              health and important details together, so you can focus on being
              together.
            </p>
            <div className="hero-actions">
              <button
                className="button"
                onClick={() => setAccountMode('register')}
              >
                Create your dog’s profile <ArrowRight size={18} />
              </button>
              <a className="text-link" href="#services">
                Explore Pawfolio <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-reassurance">
              <span>
                <Check size={12} />
              </span>
              A little less paperwork. A little more tail wagging.
            </div>
          </div>
          <div className="hero-art">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <PawPrint
              className="decorative-paw"
              fill="currentColor"
              aria-hidden="true"
            />
            <div className="photo-card">
              <PetPortrait />
              <div className="photo-caption">
                <span>YOUR BEST FRIEND. OUR PRIORITY.</span>
                <Heart size={17} />
              </div>
            </div>
            <div className="health-float">
              <div className="float-title">
                <span className="icon-box peach">
                  <PawPrint size={19} fill="currentColor" />
                </span>
                <div>
                  <strong>Buster’s health summary</strong>
                  <small>A very good boy, in very good hands.</small>
                </div>
                <span className="status-dot" />
              </div>
              <div className="float-stats">
                <div>
                  <span className="icon-box yellow">
                    <Syringe size={17} />
                  </span>
                  <div>
                    <small>Upcoming vaccine</small>
                    <strong>1 due soon</strong>
                  </div>
                </div>
                <div>
                  <span className="icon-box green">
                    <Scissors size={17} />
                  </span>
                  <div>
                    <small>Next grooming</small>
                    <strong>Saturday</strong>
                  </div>
                </div>
              </div>
              <div className="float-footer">
                <Check size={12} /> All the little details. One happy home.
              </div>
            </div>
            <div className="care-note">
              <span className="note-heart">
                <Heart size={19} fill="currentColor" />
              </span>
              <span>
                A whole lot of love.
                <br />
                <strong>A little help from us.</strong>
              </span>
            </div>
            <span className="art-bottom-label">
              ILLUSTRATIVE DASHBOARD PREVIEW <ArrowUpRight size={13} />
            </span>
          </div>
        </section>
        <div className="care-bar container">
          <span>
            One profile.<strong>A whole lot of care.</strong>
          </span>
          <div>
            <Syringe />
            Vaccinations
          </div>
          <div>
            <ClipboardPlus />
            Health records
          </div>
          <div>
            <CalendarDays />
            Daily routines
          </div>
          <div>
            <ShieldPlus />
            Emergency details
          </div>
        </div>
        <section
          className="services container"
          id="services"
          aria-labelledby="services-title"
        >
          <div className="section-intro">
            <div>
              <span className="eyebrow">THE LITTLE THINGS, TAKEN CARE OF</span>
              <h2 id="services-title">
                Everything they need.
                <br />
                All in one place.
              </h2>
            </div>
            <p>
              Less searching through folders.
              <br />
              More feeling like you’ve got this.
            </p>
          </div>
          <div className="service-grid">
            {services.map(
              ({ icon: Icon, color, title, text, detail }, index) => (
                <article className="service-card" key={title}>
                  <div className="service-top">
                    <span className={`icon-box ${color}`}>
                      <Icon size={24} />
                    </span>
                    <span className="service-number">0{index + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <div className="service-detail">{detail}</div>
                </article>
              ),
            )}
          </div>
        </section>
        <section
          className="about container"
          id="about"
          aria-labelledby="about-title"
        >
          <div className="about-illustration">
            <span className="about-ring" />
            <PawPrint
              className="big-paw"
              fill="currentColor"
              strokeWidth={0.8}
              aria-hidden="true"
            />
            <span className="about-sticker">
              <Heart size={15} /> Family comes in all sizes.
            </span>
            <span className="about-art-text">
              Small paws.
              <br />A big part of your life.
            </span>
          </div>
          <div className="about-copy">
            <span className="eyebrow">HELLO, WE’RE PAWFOLIO</span>
            <h2 id="about-title">
              Made for dogs.
              <br />
              Designed for their people.
            </h2>
            <p>
              Being a dog parent means keeping track of a lot of little things.
              A vaccination card here. A vet’s note there. A grooming
              appointment to remember.
            </p>
            <p>
              Pawfolio brings it all together in a simple, centralized digital
              dog profile. Because caring for your best friend should feel a
              little easier.
            </p>
            <a className="text-link" href="#services">
              Get to know our services <ArrowRight size={17} />
            </a>
          </div>
        </section>
        <section className="how container" aria-labelledby="how-title">
          <div className="section-intro">
            <div>
              <span className="eyebrow">LESS TO KEEP TRACK OF</span>
              <h2 id="how-title">A simpler way to care.</h2>
            </div>
            <p>
              From the first hello to every day after.
              <br />
              Your dog’s story starts here.
            </p>
          </div>
          <div className="steps">
            <article>
              <span>01</span>
              <h3>Meet your dog’s new profile</h3>
              <p>
                A home for their name, breed, weight, and all the details that
                make them, them.
              </p>
            </article>
            <article>
              <span>02</span>
              <h3>Bring the details together</h3>
              <p>
                Add health records, vaccination dates, and daily routines to
                their story.
              </p>
            </article>
            <article>
              <span>03</span>
              <h3>See the whole picture</h3>
              <p>
                Get a clear overview of their care every time you open your
                dashboard.
              </p>
            </article>
          </div>
        </section>
        <section
          className="faq container"
          id="help"
          aria-labelledby="faq-title"
        >
          <div>
            <span className="eyebrow">HERE TO HELP</span>
            <h2 id="faq-title">
              A few good
              <br />
              questions.
            </h2>
            <p>Getting to know Pawfolio.</p>
          </div>
          <div className="faq-list">
            <details open>
              <summary>
                What is Pawfolio?
                <ChevronDown size={18} />
              </summary>
              <p>
                Pawfolio is a centralized digital dog profile that keeps
                vaccinations, medical records, schedules, and emergency
                information together in one place.
              </p>
            </details>
            <details>
              <summary>
                What information goes in a dog profile?
                <ChevronDown size={18} />
              </summary>
              <p>
                Your dog’s name, breed, age, weight, microchip details, vet
                information, health records, vaccination dates, and grooming
                appointments.
              </p>
            </details>
            <details>
              <summary>
                Does Pawfolio replace my veterinarian?
                <ChevronDown size={18} />
              </summary>
              <p>
                Pawfolio helps organize your dog’s information. Your
                veterinarian remains your contact for diagnosis, treatment, and
                advice about your dog’s health.
              </p>
            </details>
          </div>
        </section>
        <section className="cta container">
          <div className="cta-content">
            <span className="eyebrow">
              GOOD CARE STARTS WITH THE LITTLE THINGS
            </span>
            <h2>
              More together.
              <br />
              <span>Less to keep track of.</span>
            </h2>
            <p>Give your dog’s important details a place to call home.</p>
            <button
              className="button"
              onClick={() => setAccountMode('register')}
            >
              Get started with Pawfolio <ArrowRight size={18} />
            </button>
          </div>
          <div className="cta-paws" aria-hidden="true">
            <PawPrint fill="currentColor" />
            <Heart />
          </div>
        </section>
      </main>
      <footer className="container">
        <div className="footer-top">
          <Logo />
          <p>
            Thoughtful care.
            <br />
            For the ones you call family.
          </p>
          <a href="#about">About us</a>
          <a href="#services">Our services</a>
          <a href="#help">Help & FAQs</a>
          <a href="/contact">Contact us</a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Pawfolio. All rights reserved.
          </span>
          <span>
            Made with care, for every paw. <PawPrint size={12} />
          </span>
        </div>
      </footer>
      <PolicyLinks />
    </>
  );
}
