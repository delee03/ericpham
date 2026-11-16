// Translucent bordered card used across the plain page and blog.
export default function Panel({ as: Tag = "div", highlight = false, className = "", children, ...rest }) {
    return (
        <Tag
            className={`rounded-[18px] border bg-panel p-5 sm:p-6 ${
                highlight ? "border-gold" : "border-sky/20"
            } ${className}`}
            {...rest}
        >
            {children}
        </Tag>
    );
}
