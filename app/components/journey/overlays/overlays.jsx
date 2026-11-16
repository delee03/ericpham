"use client";

import { useCallback, useRef } from "react";
import ContactForm from "@/app/components/site/contact-form";
import { contactsData } from "@/utils/data/contactsData";
import { educations } from "@/utils/data/educations";
import { experiences } from "@/utils/data/experience";
import { flybyProjects, heroCopy, journeyLevels, aboutShort } from "@/utils/data/journey";
import { personalData } from "@/utils/data/personal-data";
import { skillGroups } from "@/utils/data/skills";
import { smoothstep } from "../easing";
import { engine } from "../journey-engine";
import { useFrameEffect, useUi } from "../use-ui";
import Link from "next/link";

const caption = (i) => journeyLevels[i].caption;

const CAPTION =
    "font-display text-[27px] font-light leading-[1.18] text-gold md:text-[40px] md:leading-[1.15]";
const PANEL = "rounded-2xl border border-sky/20 bg-panel backdrop-blur-[14px] md:rounded-[18px]";
const LABEL = "font-mono text-[11px] tracking-[0.16em] text-sky md:text-xs";
const MORE_BTN =
    "min-h-[44px] self-start rounded-full border border-ink/35 px-5 text-sm text-ink transition-colors hover:border-sky";
// Wrapper for a level's content: fixed to the top, scrolls if it ever overflows.
const SLAB =
    "pointer-events-auto absolute inset-x-5 top-[92px] flex max-h-[calc(100svh-92px-150px)] flex-col gap-3.5 overflow-y-auto overscroll-contain md:left-[88px] md:top-[var(--t)] md:max-h-[calc(100svh-var(--t)-130px)] md:gap-5";

const nameTail = personalData.name; // "Thuận Phát"
const nameHead = personalData.fullName.replace(nameTail, "").trim(); // "Phạm Tiến"
const certName = (c) => c.title.replace(/^AWS (Certified )?/, "");

function Level({ index, level, children, setRef }) {
    const active = level === index;
    return (
        <div
            ref={setRef}
            data-level={index}
            inert={!active}
            aria-hidden={!active}
            className="pointer-events-none absolute inset-0"
            style={{ opacity: index === 0 ? 1 : 0 }}
        >
            {children}
        </div>
    );
}

export default function Overlays({ blogs, openDrawer }) {
    const { level } = useUi();
    const refs = useRef([]);

    // Content fades in during holds and out as travel begins (DOM, not React state).
    const fade = useCallback((j) => {
        refs.current.forEach((el, i) => {
            if (!el) return;
            const o = 1 - smoothstep(0.02, 0.3, Math.abs(j.p - i));
            const v = o.toFixed(3);
            if (el.dataset.o !== v) {
                el.dataset.o = v;
                el.style.opacity = v;
            }
        });
    }, []);
    useFrameEffect(fade);

    const bind = (i) => (el) => {
        refs.current[i] = el;
    };
    const latestBlogs = (blogs || []).slice(0, 3);
    const awsCerts = educations.filter((e) => e.institution === "Amazon Web Services");
    const [msgA, msgB] = (caption(6) || "").split(/,\s*/);

    return (
        <main className="pointer-events-none fixed inset-0 z-20">
            {/* 0 · You */}
            <Level index={0} level={level} setRef={bind(0)}>
                <section
                    data-scroll-panel
                    className="pointer-events-auto absolute inset-x-5 top-[104px] flex flex-col gap-4 md:left-[88px] md:right-auto md:top-[max(110px,24svh)] md:w-[620px] md:gap-[22px]"
                >
                    <p className="font-mono text-[11px] tracking-[0.16em] text-sky md:text-[13px] md:tracking-[0.2em]">
                        {heroCopy.coordinates}
                    </p>
                    <h1 className="font-display text-[46px] font-semibold leading-[1.02] tracking-[-0.02em] md:text-[76px]">
                        {nameHead}
                        <br />
                        {nameTail}
                    </h1>
                    <p className="font-mono text-[12px] tracking-[0.12em] text-dim md:text-[13px]">
                        English name: {personalData.englishName}
                    </p>
                    <p className="text-[17px] leading-[1.5] text-muted md:text-xl">{heroCopy.tagline}</p>
                    <div className="flex flex-wrap gap-2.5 md:gap-3.5">
                        <a
                            href={personalData.resume}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-[48px] items-center rounded-full bg-ink px-[22px] text-[15px] font-semibold text-void md:px-6"
                        >
                            Get resume
                        </a>
                        <a
                            href="#contact"
                            onClick={(e) => {
                                e.preventDefault();
                                engine.goTo(7);
                            }}
                            className="flex min-h-[48px] items-center rounded-full border border-ink/40 px-[22px] text-[15px] text-ink md:px-6"
                        >
                            Contact me
                        </a>
                    </div>
                </section>
            </Level>

            {/* 1 · About */}
            <Level index={1} level={level} setRef={bind(1)}>
                <section data-scroll-panel className={`${SLAB} md:[--t:max(100px,17svh)] md:w-[560px]`}>
                    <h2 className={CAPTION}>{caption(1)}</h2>
                    <div className={`${PANEL} flex flex-col gap-2.5 px-5 py-[18px] md:gap-3 md:px-7 md:py-[26px]`}>
                        <p className={LABEL}>ABOUT</p>
                        {aboutShort.map((t) => (
                            <p key={t} className="text-[15px] leading-[1.55] text-soft md:text-base md:leading-[1.6]">
                                {t}
                            </p>
                        ))}
                        <button type="button" onClick={() => openDrawer("about")} className={`${MORE_BTN} mt-1`}>
                            More
                        </button>
                    </div>
                </section>
            </Level>

            {/* 2 · Experience */}
            <Level index={2} level={level} setRef={bind(2)}>
                <section data-scroll-panel className={`${SLAB} md:right-[200px] md:[--t:max(100px,15svh)] md:gap-[30px]`}>
                    <h2 className={CAPTION}>{caption(2)}</h2>
                    <ul className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4">
                        {experiences.map((e, i) => (
                            <li
                                key={e.id}
                                className={`flex flex-col gap-0.5 rounded-[14px] border bg-panel px-4 py-3 backdrop-blur-[12px] md:gap-1.5 md:rounded-2xl md:p-5 ${
                                    i === 0 ? "border-gold" : "border-sky/20"
                                }`}
                            >
                                <span className={`font-mono text-[11px] md:text-xs ${i === 0 ? "text-gold" : "text-sky"}`}>
                                    {e.duration.replace(/[()]/g, "").toUpperCase()}
                                </span>
                                <span className="font-display text-[17px] font-medium md:text-[19px]">{e.title}</span>
                                <span className="text-[13px] text-muted md:text-sm">{e.company}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            </Level>

            {/* 3 · Projects */}
            <Level index={3} level={level} setRef={bind(3)}>
                <section data-scroll-panel className={`${SLAB} md:[--t:max(100px,16svh)] md:w-[640px]`}>
                    <h2 className={CAPTION}>{caption(3)}</h2>
                    <ul className="grid grid-cols-2 gap-2 md:gap-3.5">
                        {flybyProjects.map((p, i) => (
                            <li
                                key={p.projectId}
                                className="flex flex-col gap-1.5 rounded-[14px] border border-sky/20 bg-panel p-3.5 backdrop-blur-[12px] md:gap-2 md:rounded-2xl md:p-5"
                            >
                                <span className="font-mono text-[10px] text-sky md:text-xs">
                                    {p.planet.toUpperCase()} · {String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="font-display text-base font-medium md:text-[19px]">{p.title}</span>
                                <span className="line-clamp-1 text-[13px] leading-[1.45] text-muted md:line-clamp-none md:text-sm md:leading-[1.5]">
                                    {p.blurb}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <button type="button" onClick={() => openDrawer("projects")} className={MORE_BTN}>
                        More projects
                    </button>
                </section>
            </Level>

            {/* 4 · Pale Blue Dot */}
            <Level index={4} level={level} setRef={bind(4)}>
                <h2 className="absolute inset-x-6 top-[50svh] text-balance text-center font-display text-[25px] font-light leading-tight text-gold md:inset-x-0 md:top-[52svh] md:text-[34px]">
                    {caption(4)}
                </h2>
            </Level>

            {/* 5 · Skills and certificates */}
            <Level index={5} level={level} setRef={bind(5)}>
                <section data-scroll-panel className={`${SLAB} md:[--t:max(96px,14svh)] md:w-[560px]`}>
                    <h2 className={CAPTION}>{caption(5)}</h2>
                    <div className={`${PANEL} flex flex-col gap-3 px-5 py-[18px] md:gap-4 md:px-[26px] md:py-6`}>
                        {skillGroups.map((g) => (
                            <div key={g.label} className="flex flex-col gap-1 md:gap-1.5">
                                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-sky md:text-xs md:tracking-[0.14em]">
                                    {g.label}
                                </p>
                                <p className="text-sm leading-[1.45] text-soft md:text-[15px]">{g.items.join(" · ")}</p>
                            </div>
                        ))}
                        <div className="h-px bg-sky/20" />
                        <ul className="grid grid-cols-1 gap-1 text-[13px] text-gold md:grid-cols-2 md:gap-2.5 md:text-sm">
                            {awsCerts.slice(0, 2).map((c) => (
                                <li key={c.id}>★ AWS {certName(c)}</li>
                            ))}
                            {/* On mobile the two practitioner certs share one line. */}
                            <li className="md:contents">
                                {awsCerts.slice(2).map((c, k) => (
                                    <span key={c.id} className="md:block">
                                        {k > 0 && <span className="md:hidden"> · </span>}
                                        <span className={k > 0 ? "max-md:hidden" : ""}>★ </span>
                                        <span className={k > 0 ? "max-md:hidden" : ""}>AWS </span>
                                        {certName(c)}
                                    </span>
                                ))}
                            </li>
                        </ul>
                        <div className="flex flex-wrap gap-2.5">
                            <button type="button" onClick={() => openDrawer("education")} className={MORE_BTN}>
                                Education and certificates
                            </button>
                            {latestBlogs.length > 0 && (
                                <button type="button" onClick={() => openDrawer("writing")} className={MORE_BTN}>
                                    Transmissions
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            </Level>

            {/* 6 · Message */}
            <Level index={6} level={level} setRef={bind(6)}>
                <h2 className="absolute inset-x-5 top-[38svh] text-balance text-center font-display text-[40px] font-light leading-[1.08] tracking-[-0.01em] md:top-[37svh] md:text-[72px] md:leading-[1.05] md:tracking-[-0.02em]">
                    <span className="md:block">{msgA},</span> <span className="md:block">{msgB}</span>
                </h2>
            </Level>

            {/* 7 · Contact */}
            <Level index={7} level={level} setRef={bind(7)}>
                <section
                    id="contact"
                    data-scroll-panel
                    className={`${SLAB} md:[--t:max(100px,13svh)] md:w-[540px]`}
                >
                    <h2 className={`${CAPTION} max-md:text-[25px]`}>{caption(7)}</h2>
                    <div className={`${PANEL} flex flex-col gap-3 px-[18px] py-4 md:gap-3.5 md:px-[26px] md:py-6`}>
                        <ContactForm />
                        <div className="text-[13px] leading-[1.7] text-muted md:text-sm">
                            <a href={`mailto:${contactsData.email}`} className="hover:text-ink">
                                {contactsData.email}
                            </a>
                            {" · "}
                            {contactsData.address}
                            <br />
                            <a href={contactsData.github} target="_blank" rel="noopener noreferrer" className="text-sky hover:text-ink">
                                GitHub
                            </a>
                            {" · "}
                            <a href={contactsData.linkedIn} target="_blank" rel="noopener noreferrer" className="text-sky hover:text-ink">
                                LinkedIn
                            </a>
                            {" · "}
                            <a href={contactsData.x} target="_blank" rel="noopener noreferrer" className="text-sky hover:text-ink">
                                X
                            </a>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <button
                            type="button"
                            onClick={() => engine.goTo(0)}
                            className="min-h-[44px] self-start rounded-full border border-ink/35 px-5 text-sm text-ink hover:border-sky"
                        >
                            ↺ Zoom out again
                        </button>
                        <Link href="/plain#credits" className="inline-flex min-h-[44px] items-center text-[13px] text-muted underline underline-offset-4 hover:text-ink">
                            Image credits
                        </Link>
                    </div>
                </section>
            </Level>
        </main>
    );
}
