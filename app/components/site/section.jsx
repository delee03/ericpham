// Page section with mono label, gold display caption and an h2.
export default function Section({ id, label, caption, title, children }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16 py-14 sm:py-20">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-sky">{label}</p>
            <h2
                id={`${id}-title`}
                className="mt-3 max-w-3xl font-display text-2xl font-light leading-snug text-gold sm:text-4xl"
            >
                {caption || title}
            </h2>
            {caption && <p className="mt-2 font-display text-lg text-ink sm:text-xl">{title}</p>}
            <div className="mt-8">{children}</div>
        </section>
    );
}
