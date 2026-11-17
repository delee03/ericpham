// Link-preview (Open Graph / Twitter) metadata shared by every page, so each
// one carries the same 1200×630 image at public/og.jpg. Next does not merge
// `openGraph` between layouts and pages, hence the helper.
const image = {
    url: "/og.jpg",
    width: 1200,
    height: 630,
    type: "image/jpeg",
    alt: "Phạm Tiến Thuận Phát (English name: Eric), Cloud Solutions Architect and AI Engineer, over a sunrise on Earth seen from orbit",
};

export function shareMeta({ title, description, url }) {
    return {
        openGraph: { type: "website", siteName: "Thuận Phát (Eric)", title, description, url, images: [image] },
        twitter: { card: "summary_large_image", title, description, images: [image] },
    };
}
