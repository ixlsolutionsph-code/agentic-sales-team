"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HERO_EMAIL_KEY, loaderDuration, normaliseEmail } from "@/lib/landing";
import Login from "./Login";
import Hero from "./landing/Hero";
import Loader from "./landing/Loader";
import Nav from "./landing/Nav";
import { FinalCta, Footer, HowItWorks, Inbox, Plans, Rules, Team, Trust } from "./landing/Sections";

type AuthMode = "login" | "signup";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Landing() {
  const [reduced, setReduced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaderMs, setLoaderMs] = useState(loaderDuration(false));
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState("");
  const root = useRef<HTMLDivElement>(null);

  // Loader: at least 3 s, or 250 ms with reduced motion.
  useEffect(() => {
    const r = prefersReducedMotion();
    setReduced(r);
    const ms = loaderDuration(r);
    setLoaderMs(ms);
    const id = window.setTimeout(() => setLoading(false), ms);
    return () => window.clearTimeout(id);
  }, []);

  // Stop the page scrolling under the loader.
  useEffect(() => {
    document.documentElement.style.overflow = loading ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [loading]);

  // Scroll animations (GSAP is used on the landing page only).
  useEffect(() => {
    if (loading || auth || reduced || !root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from("[data-hero]", { y: 20, opacity: 0, duration: 0.7, ease: "power2.out", stagger: 0.08 });

      gsap.fromTo(
        "[data-tilt]",
        { rotateX: 16, scale: 0.94 },
        {
          rotateX: 0,
          scale: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: 520, scrub: true },
        },
      );

      gsap.fromTo(
        ".lp-progress",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { start: 0, end: "max", scrub: 0.2 },
        },
      );

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, {
          y: 28,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    }, root);
    return () => ctx.revert();
  }, [loading, auth, reduced]);

  const openAuth = useCallback((mode: AuthMode) => {
    let saved = "";
    try {
      saved = window.sessionStorage.getItem(HERO_EMAIL_KEY) ?? "";
    } catch {
      // Storage can be blocked. The form still works without it.
    }
    setEmail(saved);
    setAuth(mode);
    window.scrollTo(0, 0);
  }, []);

  const onHeroEmail = useCallback(
    (value: string) => {
      try {
        window.sessionStorage.setItem(HERO_EMAIL_KEY, normaliseEmail(value));
      } catch {
        // Ignore: sign-up will ask for the email again.
      }
      openAuth("signup");
    },
    [openAuth],
  );

  if (auth) return <Login initialMode={auth} initialEmail={email} onBack={() => setAuth(null)} />;

  return (
    <div className="lp" ref={root}>
      <Loader done={!loading} ms={loaderMs} />
      <div className="lp-progress" aria-hidden="true" />
      <Nav onAuth={openAuth} />
      <main>
        <Hero onEmail={onHeroEmail} play={!loading} reduced={reduced} />
        <Team />
        <HowItWorks />
        <Inbox />
        <Rules />
        <Trust />
        <Plans onAuth={openAuth} />
        <FinalCta onAuth={openAuth} />
      </main>
      <Footer />
    </div>
  );
}
