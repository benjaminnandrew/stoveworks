import Image from "next/image";

import type { Media, Section } from "@/content/types";

function Figure({ media, sizes }: { media: Media; sizes?: string }) {
  const img = (
    <Image
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      sizes={sizes}
    />
  );

  if (!media.href) return img;

  const external = !media.href.startsWith("/");
  return (
    <a
      className="logo-link"
      href={media.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {img}
    </a>
  );
}

/**
 * Content HTML is authored in `src/content` — it is not user input, so it is
 * safe to render directly.
 */
function Html({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function SectionBlock({ section }: { section: Section }) {
  switch (section.type) {
    case "prose":
      return <Html className="prose" html={section.html} />;

    case "prose-aside":
      return (
        <div className="prose-aside">
          <Html className="prose" html={section.html} />
          <div className="aside">
            {section.aside.map((m) => (
              <Figure key={m.src + (m.href ?? "")} media={m} sizes="(max-width: 768px) 60vw, 320px" />
            ))}
          </div>
        </div>
      );

    case "brand":
      return (
        <article className="brand">
          <div>
            <h3>{section.name}</h3>
            <Html className="brand-body" html={section.body} />
          </div>
          <div className="brand-logo">
            <Figure media={section.logo} sizes="(max-width: 768px) 60vw, 320px" />
          </div>
        </article>
      );

    case "media-grid":
      return (
        <div className="media-grid" data-cols={section.cols}>
          {section.items.map((m) => (
            <Figure
              key={m.src + (m.href ?? "")}
              media={m}
              sizes={`(max-width: 700px) 90vw, ${Math.round(100 / section.cols)}vw`}
            />
          ))}
        </div>
      );

    case "embed":
      return (
        <div className="embed-frame">
          <iframe
            src={extractSrc(section.html)}
            title="Map"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      );
  }
}

function extractSrc(html: string) {
  return html.match(/src="([^"]+)"/)?.[1] ?? "";
}

export function PageSections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((section, i) => (
        <div className="section" key={i}>
          <SectionBlock section={section} />
        </div>
      ))}
    </>
  );
}
