import Image from "next/image";
import Link from "next/link";
import BlogCard from "@/app/components/site/blog-card";
import ContactForm from "@/app/components/site/contact-form";
import Panel from "@/app/components/site/panel";
import Section from "@/app/components/site/section";
import SiteFooter from "@/app/components/site/site-footer";
import SiteHeader from "@/app/components/site/site-header";
import { devToProfileUrl, getBlogs } from "@/utils/blog";
import { contactsData } from "@/utils/data/contactsData";
import { educations } from "@/utils/data/educations";
import { experiences } from "@/utils/data/experience";
import { heroCopy, journeyLevels } from "@/utils/data/journey";
import { personalData } from "@/utils/data/personal-data";
import { projectsData } from "@/utils/data/projects-data";
import { skillGroups } from "@/utils/data/skills";
import { shareMeta } from "@/utils/share-meta";

const title = "Thuận Phát (Eric) - Cloud Solutions Architect & AI Engineer";
const description =
    "Plain, fast version of the portfolio of Phạm Tiến Thuận Phát (English name: Eric): experience, projects, skills, writing and contact.";

export const metadata = {
    title,
    description,
    ...shareMeta({ title, description, url: "/plain" }),
};

const caption = (id) => journeyLevels.find((l) => l.id === id)?.caption;

const socials = [
    { label: "GitHub", href: personalData.github },
    { label: "LinkedIn", href: personalData.linkedIn },
    { label: "X", href: personalData.twitter },
    { label: "Facebook", href: personalData.facebook },
    { label: "StackOverflow", href: personalData.stackOverflow },
    { label: "LeetCode", href: personalData.leetcode },
    { label: "dev.to", href: devToProfileUrl },
];

const chip =
    "rounded-full border border-line bg-field px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-soft";
const extLink =
    "inline-flex min-h-[44px] items-center text-sky underline underline-offset-4 hover:text-ink";

export default async function PlainPage() {
    const { blogs, failed } = await getBlogs();
    const latest = blogs.slice(0, 6);
    const certs = educations.filter((e) => !/degree/i.test(e.title));
    const degrees = educations.filter((e) => /degree/i.test(e.title));

    return (
        <div className="site-stars min-h-screen">
            <SiteHeader />
            <main className="mx-auto max-w-6xl px-4 sm:px-8">
                {/* Hero */}
                <section aria-labelledby="hero-title" className="grid items-center gap-10 py-14 sm:py-24 md:grid-cols-[1fr_auto]">
                    <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-sky sm:text-xs sm:tracking-[0.2em]">{heroCopy.coordinates}</p>
                        <h1
                            id="hero-title"
                            className="mt-4 font-display text-4xl font-light leading-tight sm:text-6xl"
                        >
                            {personalData.fullName}
                        </h1>
                        <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                            English name: {personalData.englishName}
                        </p>
                        <p className="mt-6 max-w-xl text-lg text-soft">{heroCopy.tagline}</p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <a
                                href={personalData.resume}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[44px] items-center rounded-full bg-gold px-6 font-mono text-xs font-medium uppercase tracking-[0.14em] text-void hover:opacity-90"
                            >
                                Get resume
                                <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                            <a
                                href="#contact"
                                className="inline-flex min-h-[44px] items-center rounded-full border border-sky/40 px-6 font-mono text-xs uppercase tracking-[0.14em] text-sky hover:border-sky"
                            >
                                Contact me
                            </a>
                        </div>
                    </div>
                    <Image
                        src={personalData.profile}
                        alt={`Portrait of ${personalData.name}`}
                        width={240}
                        height={240}
                        priority
                        className="h-40 w-40 rounded-[28px] border border-sky/20 object-cover sm:h-60 sm:w-60"
                    />
                </section>

                <Section id="about" label="About" caption={caption("about")} title="Who I am">
                    <p className="max-w-3xl leading-relaxed text-soft">{personalData.description}</p>
                </Section>

                <Section id="experience" label="Experience" caption={caption("experience")} title="Where I have worked">
                    <ol className="grid gap-4 md:grid-cols-2">
                        {experiences.map((e, i) => (
                            <li key={e.id}>
                                <Panel highlight={i === 0} className="h-full">
                                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-sky">
                                        {e.duration.replace(/[()]/g, "")}
                                        {i === 0 ? " · Current" : ""}
                                    </p>
                                    <h3 className="mt-2 font-display text-xl font-medium">{e.title}</h3>
                                    <p className="mt-1 text-muted">{e.company}</p>
                                </Panel>
                            </li>
                        ))}
                    </ol>
                </Section>

                <Section id="projects" label="Projects" caption={caption("projects")} title="What I built">
                    <ul className="grid gap-4 lg:grid-cols-2">
                        {projectsData.map((p) => (
                            <li key={p.id}>
                                <Panel as="article" className="flex h-full flex-col">
                                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-sky">{p.role}</p>
                                    <h3 className="mt-2 font-display text-xl font-medium leading-snug">{p.name}</h3>
                                    <p className="mt-3 text-sm leading-relaxed text-soft">{p.description}</p>
                                    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tools">
                                        {p.tools.map((t) => (
                                            <li key={t} className={chip}>
                                                {t}
                                            </li>
                                        ))}
                                    </ul>
                                    {(p.demo || p.code) && (
                                        <div className="mt-3 flex flex-wrap gap-x-5">
                                            {p.demo && (
                                                <a href={p.demo} target="_blank" rel="noopener noreferrer" className={extLink}>
                                                    Live demo<span className="sr-only">: {p.name} (opens in a new tab)</span>
                                                </a>
                                            )}
                                            {p.code && (
                                                <a href={p.code} target="_blank" rel="noopener noreferrer" className={extLink}>
                                                    Source code<span className="sr-only">: {p.name} (opens in a new tab)</span>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </Panel>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section id="skills" label="Skills and certifications" caption={caption("skills")} title="What I work with">
                    <div className="grid gap-4 md:grid-cols-3">
                        {skillGroups.map((g) => (
                            <Panel key={g.label}>
                                <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-sky">{g.label}</h3>
                                <ul className="mt-4 flex flex-wrap gap-2">
                                    {g.items.map((s) => (
                                        <li key={s} className={chip}>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </Panel>
                        ))}
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Panel>
                            <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-sky">Certificates</h3>
                            <ul className="mt-4 space-y-3">
                                {certs.map((c) => (
                                    <li key={c.id}>
                                        <p className="font-medium">{c.title}</p>
                                        <p className="text-sm text-muted">
                                            {c.institution} · {c.duration}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                        <Panel>
                            <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-sky">Education</h3>
                            <ul className="mt-4 space-y-3">
                                {degrees.map((c) => (
                                    <li key={c.id}>
                                        <p className="font-medium">{c.title}</p>
                                        <p className="text-sm text-muted">
                                            {c.institution} · {c.duration}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </div>
                </Section>

                <Section id="writing" label="Transmissions" title="Latest writing">
                    {latest.length > 0 ? (
                        <>
                            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {latest.map((b) => (
                                    <li key={b.id ?? b.url}>
                                        <BlogCard blog={b} />
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-6">
                                <Link href="/blog" className={extLink}>
                                    All articles
                                </Link>
                            </p>
                        </>
                    ) : (
                        <p className="text-soft">
                            {failed ? "The articles could not be loaded right now. " : "No articles yet. "}
                            <a href={devToProfileUrl} target="_blank" rel="noopener noreferrer" className={extLink}>
                                {failed ? "Read them on dev.to" : "Visit dev.to"}
                            </a>
                            .
                        </p>
                    )}
                </Section>

                <Section id="contact" label="Contact" caption={caption("contact")} title="Get in touch">
                    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
                        <Panel>
                            <ContactForm />
                        </Panel>
                        <Panel>
                            <h3 className="font-mono text-xs uppercase tracking-[0.14em] text-sky">Direct</h3>
                            <ul className="mt-3 space-y-1 text-soft">
                                <li>
                                    <a href={`tel:${contactsData.phone.replace(/\s/g, "")}`} className={extLink}>
                                        {contactsData.phone}
                                    </a>
                                </li>
                                <li className="py-2.5">{contactsData.address}</li>
                            </ul>
                            <h3 className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-sky">Elsewhere</h3>
                            <ul className="mt-3 flex flex-wrap gap-x-5">
                                {socials.map((s) => (
                                    <li key={s.label}>
                                        <a href={s.href} target="_blank" rel="noopener noreferrer" className={extLink}>
                                            {s.label}
                                            <span className="sr-only"> (opens in a new tab)</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    </div>
                </Section>
            </main>
            <SiteFooter />
        </div>
    );
}
