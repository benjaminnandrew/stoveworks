import Image from "next/image";
import Link from "next/link";

import { Gallery } from "@/components/Gallery";
import {
  featureTiles,
  gallery,
  galleryHeading,
  hero,
  history,
  intro,
} from "@/content/home";

export default function HomePage() {
  return (
    <>
      <div className="hero">
        <Image
          src={hero.src}
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          priority
          sizes="100vw"
        />
      </div>

      <div className="wrap">
        <div className="home-intro">
          <h1>{intro.heading}</h1>
          <p>{intro.body}</p>
        </div>

        <div className="tiles">
          {featureTiles.map((tile) => (
            <Link key={tile.href} href={tile.href} className="tile">
              <Image
                src={tile.image.src}
                alt=""
                width={tile.image.width}
                height={tile.image.height}
                sizes="(max-width: 560px) 92vw, (max-width: 980px) 46vw, 24vw"
              />
              <span className="tile-caption">
                <h2>{tile.title}</h2>
                <p>{tile.blurb}</p>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <section
        className="history"
        style={{ backgroundImage: `url(${history.background})` }}
        aria-labelledby="history-heading"
      >
        <div className="wrap">
          <div className="history-split">
            <div>
              <h2 id="history-heading">{history.heading}</h2>
              <div dangerouslySetInnerHTML={{ __html: history.columnHtml }} />
            </div>
            <div className="history-photo">
              <Image
                src={history.photo.src}
                alt={history.photo.alt}
                width={history.photo.width}
                height={history.photo.height}
                sizes="(max-width: 820px) 92vw, 46vw"
              />
            </div>
          </div>
          <div dangerouslySetInnerHTML={{ __html: history.bodyHtml }} />
        </div>
      </section>

      <section
        className="showcase"
        style={{ backgroundImage: `url(${history.background})` }}
        aria-labelledby="showcase-heading"
      >
        <div className="wrap">
          <h2 id="showcase-heading">{galleryHeading}</h2>
          <Gallery items={gallery} />
        </div>
      </section>
    </>
  );
}
