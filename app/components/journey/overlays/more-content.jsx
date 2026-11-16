import { educations } from "@/utils/data/educations";
import { personalData } from "@/utils/data/personal-data";
import { projectsData } from "@/utils/data/projects-data";

// Long-form content for the "More" drawer. Server-renderable (no hooks).

export function AboutMore() {
    return (
        <p className="text-[15px] leading-[1.7] text-soft">{personalData.description}</p>
    );
}

export function ProjectsMore() {
    return (
        <ul className="flex flex-col gap-6">
            {projectsData.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 border-b border-line pb-6 last:border-b-0">
                    <h3 className="font-display text-lg font-medium text-ink">{p.name}</h3>
                    {p.role && <p className="font-mono text-xs tracking-wider text-sky">{p.role}</p>}
                    <p className="text-[14px] leading-[1.65] text-soft">{p.description}</p>
                    {p.tools?.length > 0 && (
                        <p className="text-[13px] text-dim">{p.tools.join(" · ")}</p>
                    )}
                    {(p.demo || p.code) && (
                        <div className="flex gap-4 pt-1 text-sm">
                            {p.demo && (
                                <a href={p.demo} target="_blank" rel="noopener noreferrer" className="text-sky underline underline-offset-4">
                                    Demo
                                </a>
                            )}
                            {p.code && (
                                <a href={p.code} target="_blank" rel="noopener noreferrer" className="text-sky underline underline-offset-4">
                                    Code
                                </a>
                            )}
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}

export function EducationMore() {
    return (
        <ul className="flex flex-col gap-5">
            {educations.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 border-b border-line pb-5 last:border-b-0">
                    <p className="font-mono text-xs text-sky">{e.duration}</p>
                    <h3 className="font-display text-[17px] font-medium text-ink">{e.title}</h3>
                    <p className="text-[14px] text-muted">{e.institution}</p>
                </li>
            ))}
        </ul>
    );
}
