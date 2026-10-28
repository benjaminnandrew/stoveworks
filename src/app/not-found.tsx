import Link from "next/link";

import { shopMenu } from "@/content/site";

export default function NotFound() {
  return (
    <>
      <div className="page-title">
        <div className="wrap">
          <h1>Page not found</h1>
        </div>
      </div>
      <div className="page-body">
        <div className="wrap">
          <div className="prose">
            <p>
              Sorry — we couldn&rsquo;t find that page. It may have moved. Try one of our main
              sections, or <Link href="/contact-us/">get in touch</Link> and we&rsquo;ll point you in
              the right direction.
            </p>
            <ul>
              {[
                ...shopMenu.heat,
                ...shopMenu.more,
                { label: "Services", href: "/services/" },
                { label: "Home & cabin decor", href: "/home-cabin-decor/" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
