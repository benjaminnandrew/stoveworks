import { servicePage } from "./services";
import type { Page } from "./types";

/**
 * Page content mirrored from the previous WordPress site.
 * Editing this file is how copy changes are made — no CMS required yet.
 */
export const pages: Page[] = [
  {
    "slug": "cook-stoves",
    "title": "Cook Stoves & Refrigerators",
    "metaTitle": "Cook Stoves in Hayward, WI",
    "description": "Cook stoves and refrigerators from Hayward Stoveworks, Northwest Wisconsin's most complete fireplace center, on County Road B in Hayward.",
    "sections": [
      {
        "type": "media-grid",
        "cols": 1,
        "items": [
          {
            "src": "/images/heartland-stove.jpg",
            "alt": "A green and chrome Heartland range on the showroom floor",
            "width": 348,
            "height": 467
          }
        ]
      }
    ]
  },
  {
    "slug": "fireplace-walls-mantels",
    "title": "Fireplace Walls & Mantels",
    "metaTitle": "Fireplace Walls & Mantels, Hayward WI",
    "description": "Cultured Stone, TriLite and St. Croix stone veneer, Stoll steel and shiplap wall panels, and log mantels from Hayward's own Dressy Log Furniture.",
    "sections": [
      {
        "type": "photos",
        "heading": "In our showroom",
        "items": [
          {
            "src": "/images/fb14.jpg",
            "alt": "A corner fireplace faced in stacked stone with a log mantel",
            "width": 720,
            "height": 960
          },
          {
            "src": "/images/fb6.jpg",
            "alt": "A stacked-stone corner fireplace with a rough log mantel",
            "width": 720,
            "height": 960
          },
          {
            "src": "/images/fb7.jpg",
            "alt": "A stone-faced fireplace with a log mantel and a firewood niche in the showroom",
            "width": 720,
            "height": 960
          },
          {
            "src": "/images/fb4.jpg",
            "alt": "A corner fireplace in stacked stone with a log mantel and a loon carving above",
            "width": 604,
            "height": 960
          },
          {
            "src": "/images/fb13.jpg",
            "alt": "A stacked-stone fireplace with a log mantel and a firewood niche",
            "width": 720,
            "height": 960
          }
        ]
      },
      {
        "type": "brand",
        "name": "St. Croix Stone by Environmental StoneWorks",
        "body": "<p>Fireplaces, both masonry design and zero clearance applications are of the most common uses of St. Croix Stone. It is also a great solution for freestanding stove applications. Fireplace companies throughout the Midwest have been recommending St. Croix Stone for over 18 years.</p>",
        "logo": {
          "src": "/images/environmental-stone-works.jpg",
          "alt": "Environmental Stone Works",
          "width": 320,
          "height": 105,
          "href": "https://www.estoneworks.com/site/products/midwest"
        }
      },
      {
        "type": "brand",
        "name": "Cultured Stone",
        "body": "<p>Cultured Stone® manufactured stone veneers meet AC-51 criteria, the strictest requirements in the industry. Products are available in more than 21 textures and more than 100 colors.</p>",
        "logo": {
          "src": "/images/cultured-stone.jpg",
          "alt": "Cultured Stone",
          "width": 320,
          "height": 65,
          "href": "https://www.culturedstone.com/"
        }
      },
      {
        "type": "brand",
        "name": "TriLite Stone Company",
        "body": "<p>TriLite Stone Company employs a process for manufactured stone that is superior to other systems because of our full color integration – not just facial coating. We invite you to tour our selections and imagine the possibilities for yourself.</p>",
        "logo": {
          "src": "/images/trilite.jpg",
          "alt": "TriLite Stone Company",
          "width": 320,
          "height": 119,
          "href": "https://trilitestone.com/"
        }
      },
      {
        "type": "brand",
        "name": "Stoll Industries",
        "body": "<p>Wall panel systems in steel and aluminum shiplap, for fireplace surrounds, backsplashes and accent walls. The steel panels come in five layouts and more than 20 finishes. The aluminum shiplap is non-combustible for fireplace use, and the panels mount even over existing brick.</p>",
        "website": "https://www.stollindustries.com/walls/"
      },
      {
        "type": "brand",
        "name": "Dressy Log Furniture",
        "body": "<p>A local Hayward, WI business, Dressy Log Furniture was established in 1999. They make custom handcrafted mantels from lodgepole pine or northern white cedar logs.</p>",
        "logo": {
          "src": "/images/dressy-log.jpg",
          "alt": "Dressy Log",
          "width": 320,
          "height": 130,
          "href": "https://dressylog.com/mantels/"
        }
      }
    ]
  },
  {
    "slug": "fireplaces",
    "title": "Fireplaces",
    "description": "Gas, wood and electric fireplaces in Hayward, WI, from 20 to 54 inches wide. We specialize in zero clearance fireplaces, open or closed with doors.",
    "sections": [
      {
        "type": "intro",
        "html": "<p>We specialize in zero clearance fireplaces, whether open or closed with doors.</p>\n<p>Your zero clearance fireplaces require a chimney, either air cooled or class A. A fireplace can vary in size from 20 inches wide to 54 inches wide.</p>",
        "image": {
          "src": "/images/feature-fireplaces.jpg",
          "alt": "A fireplace with a fieldstone surround and a wood mantel",
          "width": 281,
          "height": 281
        }
      },
      {
        "type": "fuels",
        "heading": "Choose a fuel",
        "intro": "<p>Fireplaces can be either <a href=\"/fireplaces/gas-fireplaces/\">gas</a>, <a href=\"/fireplaces/wood-fireplaces/\">wood</a>, or <a href=\"/fireplaces/electric-fireplaces/\">electric</a>.</p>"
      }
    ]
  },
  {
    "slug": "fireplaces/electric-fireplaces",
    "title": "Electric Fireplaces",
    "description": "Majestic electric fireplaces in Hayward, WI. No venting or gas lines needed, so they suit interior rooms where venting is difficult or impossible.",
    "sections": [
      {
        "type": "intro",
        "html": "<p>With no venting or gas lines required, an electric fireplace is the perfect solution for interior rooms with difficult or no venting access.</p>"
      },
      {
        "type": "brand",
        "name": "Majestic",
        "body": "<p>For over 50 years, Majestic has stood for outstanding durability, great looks, and long lasting performance. They offer a wide range of beautiful styles, sizes, and trims. Majestic brings a world of warmth and heritage to any home.</p>",
        "logo": {
          "src": "/images/majestic.jpg",
          "alt": "Majestic",
          "width": 320,
          "height": 130,
          "href": "https://www.majesticproducts.com/browse/electric-fireplaces"
        }
      }
    ]
  },
  {
    "slug": "fireplaces/gas-fireplaces",
    "title": "Gas Fireplaces",
    "description": "Gas fireplaces from Mendota, Kozy Heat, Town & Country and Jøtul, put in by factory-trained installers from Hayward Stoveworks in Hayward, WI.",
    "sections": [
      {
        "type": "brand",
        "name": "Mendota",
        "body": "<p>Mendota uses only the finest materials including 18 gauge aluminized steel for outer casing, NeoCeram® glass and stainless steel burner systems, and our fireboxes are continuously seam welded.</p>",
        "logo": {
          "src": "/images/mendota.png",
          "alt": "Mendota",
          "width": 320,
          "height": 96,
          "href": "https://mendotahearth.com/gas-fireplaces.php"
        }
      },
      {
        "type": "brand",
        "name": "Kozy Heat",
        "body": "<p>All Kozy Heat gas fireplaces are designed to operate with a thermostat control. Because our gas fireplaces are tested and comply with wall furnace standards, homeowners can set the desired room temperature using a thermostat and the fireplace will automatically turn on or off according to the desired temperature.</p>",
        "logo": {
          "src": "/images/kozy-heat.png",
          "alt": "Kozy Heat",
          "width": 320,
          "height": 89,
          "href": "https://www.kozyheat.com/products/gas-fireplaces/"
        }
      },
      {
        "type": "brand",
        "name": "Town & Country",
        "body": "<p>A Town &amp; Country product is more than a fireplace. It is an architectural feature, a sophisticated statement about you and your home – and an investment that will retain its value for years to come.</p>",
        "logo": {
          "src": "/images/town-and-country-fireplace-logo.jpg",
          "alt": "Town & Country Fireplaces",
          "width": 320,
          "height": 125,
          "href": "https://www.townandcountryfireplaces.com/product-type/indoor/"
        }
      },
      {
        "type": "brand",
        "name": "Jøtul",
        "body": "<p>At Jotul we are masters of our craft – we have been a leading manufacturer of cast iron hearths since 1853. We are proud of our high quality requirements, our tradition and our innovative design concepts. If you have high standards and demand the best – you are likely to choose a Jotul.</p>",
        "logo": {
          "src": "/images/jotul.png",
          "alt": "Jotul",
          "width": 320,
          "height": 149,
          "href": "https://www.jotul.com/"
        }
      }
    ]
  },
  {
    "slug": "fireplaces/wood-fireplaces",
    "title": "Wood Fireplaces",
    "description": "Wood fireplaces from RSF, Renaissance, Majestic, Kozy Heat and Minnesota-made Wilkening, from Hayward Stoveworks in Hayward, Wisconsin.",
    "sections": [
      {
        "type": "brand",
        "name": "RSF",
        "body": "<p>A great product with the most complete line of high-efficiency, clean-burning fireplaces on the market.</p>",
        "logo": {
          "src": "/images/rsf.jpg",
          "alt": "RSF",
          "width": 320,
          "height": 90,
          "href": "https://icc-rsf.com/fireplace/rsf/"
        }
      },
      {
        "type": "brand",
        "name": "Wilkening",
        "body": "<p>Manufactured in Walker, Minnesota, each Wilkening Fireplace Product is individually hand-crafted by our skilled personnel to assure you years of trouble-free service.</p>",
        "logo": {
          "src": "/images/logo-wilkening-fireplace.jpg",
          "alt": "Wilkening Fireplace",
          "width": 320,
          "height": 82,
          "href": "https://www.wilkeningfireplace.com/"
        }
      },
      {
        "type": "brand",
        "name": "Renaissance",
        "body": "<p>Renaissance Fireplaces™ manufactures the award winning Renaissance Rumford™. Our open hearth wood fireplace design offers major advantages over a traditional open fireplace. The hideaway guillotine door allows you to enjoy your fireplace with the door open or closed – without altering your view of the flames.</p>",
        "logo": {
          "src": "/images/renaissance-fireplaces-logo.png",
          "alt": "Renaissance Fireplaces",
          "width": 320,
          "height": 93,
          "href": "https://icc-rsf.com/fireplace/renaissance/"
        }
      },
      {
        "type": "brand",
        "name": "Majestic",
        "body": "<p>Available in both radiant and circulating models up to 50 inches in width, our wood burning fireboxes also feature a selection of optional extras like polished brass, stainless steel or black bi-fold doors as well as beautiful firebrick options that enhance the beauty of your real wood fire.</p>",
        "logo": {
          "src": "/images/majestic.jpg",
          "alt": "Majestic",
          "width": 320,
          "height": 130,
          "href": "https://www.majesticproducts.com/browse/wood-burning-fireplaces"
        }
      },
      {
        "type": "brand",
        "name": "Kozy Heat",
        "body": "<p>These fireplaces are designed as heating systems – the airtight doors are an integral part of the overall system. The doors work by sealing the fireplace, which eliminates heat loss and allows you to completely control the fire.</p>",
        "logo": {
          "src": "/images/kozy-heat.png",
          "alt": "Kozy Heat",
          "width": 320,
          "height": 89,
          "href": "https://www.kozyheat.com/products/wood-burning-fireplaces/"
        }
      }
    ]
  },
  {
    "slug": "hearth-accessories",
    "title": "Hearth Accessories",
    "description": "Gas and electric logs, glass doors, wood racks, tool sets, cleaning supplies and fire starters, plus parts to maintain your stove, fireplace or insert.",
    "sections": [
      {
        "type": "prose-aside",
        "html": "<p>Hayward Stoveworks has a wide variety of specialty hearth products like <a href=\"/hearth-accessories/gas-logs/\">gas and electric logs</a> and <a href=\"/hearth-accessories/glass-doors/\">glass doors</a>. We also have products you would need for maintenance on your stove, fireplace, or insert. In addition we carry log/wood racks, tool sets, cleaning supplies and fire starters.</p>",
        "aside": [
          {
            "src": "/images/pilgrim-logo.png",
            "alt": "Pilgrim Home and Hearth",
            "width": 320,
            "height": 142,
            "href": "https://www.pilgrimhearth.com/"
          }
        ]
      },
      {
        "type": "photos",
        "items": [
          {
            "src": "/images/fb8.jpg",
            "alt": "Stove and chimney care products, fire starters and bags of fatwood on the store's shelves",
            "width": 720,
            "height": 960
          }
        ]
      }
    ]
  },
  {
    "slug": "hearth-accessories/gas-logs",
    "title": "Gas Logs",
    "description": "Gas logs from Napoleon, Hargrove and Peterson for your fireplace, from Hayward Stoveworks, Northwest Wisconsin's most complete fireplace center.",
    "sections": [
      {
        "type": "media-grid",
        "cols": 3,
        "items": [
          {
            "src": "/images/napoleon-logo-2015.png",
            "alt": "Napoleon",
            "width": 320,
            "height": 139,
            "href": "https://www.napoleon.com/en/ca/fireplaces"
          },
          {
            "src": "/images/hargrove.jpg",
            "alt": "Hargrove",
            "width": 320,
            "height": 222,
            "href": "https://www.hargrovegaslogs.com/"
          },
          {
            "src": "/images/peterson-firelogs.jpg",
            "alt": "Peterson Firelogs",
            "width": 320,
            "height": 90,
            "href": "https://www.petersonfirelogs.com/"
          }
        ]
      }
    ]
  },
  {
    "slug": "hearth-accessories/glass-doors",
    "title": "Glass Doors",
    "metaTitle": "Fireplace Glass Doors in Hayward, WI",
    "description": "Wilkening fireplace glass doors, hand-crafted in Walker, Minnesota, from Hayward Stoveworks on County Road B in Hayward, Wisconsin.",
    "sections": [
      {
        "type": "brand",
        "name": "Wilkening",
        "body": "<p>Manufactured in Walker, Minnesota, each Wilkening Fireplace Product is individually hand-crafted by skilled personnel to assure you years of trouble-free service.</p>",
        "logo": {
          "src": "/images/logo-wilkening-fireplace.jpg",
          "alt": "Wilkening Fireplace",
          "width": 320,
          "height": 82,
          "href": "https://www.wilkeningfireplace.com/"
        }
      }
    ]
  },
  {
    "slug": "hearth-accessories/hearth-pads",
    "title": "Hearth Pads",
    "description": "Stone and tile hearth pads from Hearth Classics, American Panel and AJ Originals, so your stove sits on a non-combustible surface. In Hayward, WI.",
    "sections": [
      {
        "type": "prose",
        "html": "<p>A stove often sits on a hearth pad. This pad must be fire resistant and able to withstand the weight of the stove. The hearth pad can be as simple as a metal shield or even a concrete slab, but the stove must sit on a non-combustible surface.</p>\n<p>If you sit your stove on carpet, wood, vinyl or some other combustible material, the heat from the stove can damage, and even worse, ignite the floor materials. A hearth pad, if made well, can add beauty to your home.</p>"
      },
      {
        "type": "brand",
        "name": "Hearth Classics",
        "body": "<p>Hearth ClassicsTM tile and stone hearth pads are hand-crafted to provide the ideal foundation for your free-standing gas, wood, pellet, corn, coal or oil stove. To deliver the best protection on the market, all our pads are fully non-combustible using ThermaShieldTM technology.</p>",
        "logo": {
          "src": "/images/Hearth-Classics-logo.jpg",
          "alt": "Hearth Classics",
          "width": 320,
          "height": 84,
          "href": "https://www.hearthclassics.com/"
        }
      },
      {
        "type": "brand",
        "name": "American Panel",
        "body": "<p>Accent your home with a quality hearth pad from American Panel. Our hearth products are crafted from a variety of quality stone and ceramics – expertly finished for maximum durability.</p>",
        "logo": {
          "src": "/images/american-panel.png",
          "alt": "American Panel",
          "width": 320,
          "height": 141,
          "href": "https://americanpanelhearth.com/"
        }
      },
      {
        "type": "brand",
        "name": "AJ Originals",
        "body": "<p>AJ Manufacturing is your east coast source for premium-quality floor protectors (also known as hearth pads, hearth boards or stove boards). Our home hearth products are made with pride in Thompson, Connecticut. We offer a wide range of product options to fit every installation type.</p>",
        "logo": {
          "src": "/images/aj-manufacturing-logo.png",
          "alt": "AJ Manufacturing",
          "width": 320,
          "height": 46,
          "href": "https://ajhearthoriginals.com/products/hearth-originals/"
        }
      }
    ]
  },
  {
    "slug": "home-cabin-decor",
    "title": "Home & Cabin Decor",
    "description": "Lamps, art for over the mantel, fireplace accessories and cabin decor, with new inventory all the time. A good place to find a gift in Hayward, WI.",
    "sections": [
      {
        "type": "prose",
        "html": "<p>Hayward Stoveworks has a wide variety of fireplace accessories and home &amp; cabin decor available. We are the perfect place to find just the right gift you were looking for. With new inventory in all the time, please stop in and see the latest that Hayward Stoveworks has to offer!</p>"
      },
      {
        "type": "photos",
        "heading": "Around the store",
        "items": [
          {
            "src": "/images/fb10.jpg",
            "alt": "Stained-glass table lamps and deer metal art",
            "width": 960,
            "height": 720
          },
          {
            "src": "/images/fb9.jpg",
            "alt": "Metal welcome signs, wall hooks and a carved bear",
            "width": 960,
            "height": 720
          },
          {
            "src": "/images/fb11.jpg",
            "alt": "A pine shelf of picture frames, lanterns and seasonal decor",
            "width": 960,
            "height": 720
          },
          {
            "src": "/images/fb3.jpg",
            "alt": "Rustic shelves of cabin decor",
            "width": 960,
            "height": 720
          },
          {
            "src": "/images/fb12.jpg",
            "alt": "Leather bags and a cabin sign on a pine-panelled wall",
            "width": 720,
            "height": 960
          },
          {
            "src": "/images/decor-1-1.jpg",
            "alt": "Table lamps along the showroom counter",
            "width": 435,
            "height": 350
          },
          {
            "src": "/images/decor-2.jpg",
            "alt": "A stone fireplace with a log mantel, a Lake House sign and a metal heron",
            "width": 435,
            "height": 350
          }
        ]
      }
    ]
  },
  {
    "slug": "inserts",
    "title": "Inserts",
    "metaTitle": "Fireplace Inserts in Hayward, WI",
    "description": "Gas and wood inserts for an existing masonry fireplace: insulated doors keep the fire efficient and the glass lets you watch it. In Hayward, WI.",
    "sections": [
      {
        "type": "intro",
        "html": "<p>A fireplace insert is a device inserted into an existing masonry (real) fireplace.</p>\n<p>Fireplace inserts are made from cast iron or steel and now have self-cleaning glass doors that allow the flames of the fire to be viewed while the insulated doors remain closed, making the fire more efficient.</p>",
        "image": {
          "src": "/images/feature-inserts.jpg",
          "alt": "A fireplace insert set into a brick fireplace",
          "width": 281,
          "height": 281
        }
      },
      {
        "type": "fuels",
        "heading": "Choose a fuel",
        "intro": "<p>We offer inserts in either <a href=\"/inserts/gas-inserts/\">gas</a> or <a href=\"/inserts/wood-inserts/\">wood</a>.</p>"
      }
    ]
  },
  {
    "slug": "inserts/gas-inserts",
    "title": "Gas Inserts",
    "description": "Gas fireplace inserts from Mendota, Jøtul, Kozy Heat and Majestic for an existing masonry fireplace, from Hayward Stoveworks in Hayward, Wisconsin.",
    "sections": [
      {
        "type": "brand",
        "name": "Mendota",
        "body": "<p>Mendota luxury fireplaces are custom built in limited numbers for the thoughtful buyer who is interested in something better and more unique. Every Mendota gas fireplace is safety tested to rigorous ANSI/AGA standards and backed by a Lifetime Limited Warranty.</p>",
        "logo": {
          "src": "/images/mendota.png",
          "alt": "Mendota",
          "width": 320,
          "height": 96,
          "href": "https://mendotahearth.com/gas-inserts-fireplace.php"
        }
      },
      {
        "type": "brand",
        "name": "Jøtul",
        "body": "<p>Jotul offers a complete range of both traditional and contemporary stoves and fireplaces. Based on traditions in Norwegian craftsmanship, high quality and consistent use of good design, Jotul will continue to be the favored choice of the generations of today and tomorrow.</p>",
        "logo": {
          "src": "/images/jotul.png",
          "alt": "Jotul",
          "width": 320,
          "height": 149,
          "href": "https://www.jotul.com/products/gas-inserts"
        }
      },
      {
        "type": "brand",
        "name": "Kozy Heat",
        "body": "<p>Kozy Heat® has highly efficient gas insert fireplaces designed for both masonry and factory-built wood burning fireplaces.</p>",
        "logo": {
          "src": "/images/kozy-heat.png",
          "alt": "Kozy Heat",
          "width": 320,
          "height": 89,
          "href": "https://www.kozyheat.com/products/gas-fireplace-inserts/"
        }
      },
      {
        "type": "brand",
        "name": "Majestic",
        "body": "<p>Vented gas fireplaces are not only an effective and economical heating source but with wide selection of Majestic models to choose from, a beautiful and valuable addition to any home!</p>",
        "logo": {
          "src": "/images/majestic.jpg",
          "alt": "Majestic",
          "width": 320,
          "height": 130,
          "href": "https://www.majesticproducts.com/browse/gas-fireplace-inserts"
        }
      }
    ]
  },
  {
    "slug": "inserts/wood-inserts",
    "title": "Wood Inserts",
    "description": "Wood fireplace inserts from Jøtul, Morsø, Pacific Energy, True North, Kuma and Blaze King, from Hayward Stoveworks in Hayward, Wisconsin.",
    "sections": [
      {
        "type": "brand",
        "name": "Jøtul",
        "body": "<p>At Jotul we are masters of our craft – we have been a leading manufacturer of cast iron hearths since 1853. We are proud of our high quality requirements, our tradition and our innovative design concepts. If you have high standards and demand the best – you are likely to choose a Jotul.</p>",
        "logo": {
          "src": "/images/jotul.png",
          "alt": "Jotul",
          "width": 320,
          "height": 149,
          "href": "https://www.jotul.com/"
        }
      },
      {
        "type": "brand",
        "name": "Morsø",
        "body": "<p>Morso has been at the cutting-edge of modern woodstove design since 1853. Its reputation for high-performance, Scandinavian designed cast-iron stoves is world class, as is its “thinking-green” core that continues to innovate environmentally-responsible combustion technology and handcrafted high-quality cast iron products, using 98% recycled material.</p>",
        "logo": {
          "src": "/images/morso.jpg",
          "alt": "Morso",
          "width": 320,
          "height": 130,
          "href": "https://morsoe.com/us/product/indoor/wood-burning-stove"
        }
      },
      {
        "type": "brand",
        "name": "Pacific Energy",
        "body": "<p>Pacific Energy’s user-friendly design means controllable heat and a great view of your wood fire.</p>",
        "logo": {
          "src": "/images/pacific-energy.png",
          "alt": "Pacific Energy",
          "width": 320,
          "height": 172,
          "href": "https://www.pacificenergy.net/products/wood/"
        }
      },
      {
        "type": "brand",
        "name": "True North",
        "body": "<p>True North is the economy line from Pacific Energy Fireplace Products. Its wood insert is made in Canada.</p>",
        "logo": {
          "src": "/images/true-north.png",
          "alt": "True North",
          "width": 320,
          "height": 132,
          "href": "https://truenorthstoves.com/"
        },
        "website": "https://truenorthstoves.com/"
      },
      {
        "type": "brand",
        "name": "Kuma",
        "body": "<p>A Kuma wood fireplace insert will instantly provide efficiency, comfort, and warmth to your home. All our wood stove inserts offer state of the art technology and styling. If you need to heat a home of 1,600-2600 square feet, then look no further than Kuma Wood Stove Inserts. Stay warm, reduce energy costs, and have peace of mind that you are as efficient as possible.</p>",
        "logo": {
          "src": "/images/kuma.png",
          "alt": "Kuma",
          "width": 320,
          "height": 202,
          "href": "https://www.kumastoves.com/Content/Page/wood-inserts"
        }
      },
      {
        "type": "brand",
        "name": "Blaze King",
        "body": "<p>From the very beginning, Blaze King has focused on one simple idea: design super efficient, eco-friendly hearth products, and build them to last.</p>",
        "logo": {
          "src": "/images/logo-blazeking.jpg",
          "alt": "Blaze King",
          "width": 320,
          "height": 134,
          "href": "https://www.blazeking.com/category/products/wood-inserts/"
        }
      }
    ]
  },
  {
    "slug": "outdoor",
    "title": "Outdoor Fire Rings & Grills",
    "metaTitle": "Fire Rings & Grills in Hayward, WI",
    "description": "Pilot Rock campfire rings and outdoor grills, made in the USA since 1959, from Hayward Stoveworks on County Road B in Hayward, Wisconsin.",
    "sections": [
      {
        "type": "brand",
        "name": "Pilot Rock",
        "body": "<p>Pilot Rock products have been designed and manufactured in the United States since 1959. Nothing compares to our innovative styles, quality fabrication and diverse product line.</p>",
        "logo": {
          "src": "/images/pilot-rock-logo.jpg",
          "alt": "Pilot Rock",
          "width": 320,
          "height": 120,
          "href": "https://www.pilotrock.com/product/campfire-rings/"
        }
      }
    ]
  },
  {
    "slug": "sauna-stoves",
    "title": "Wood-Fired Sauna Stoves",
    "description": "Nippa wood-fired sauna stoves and heaters from Hayward Stoveworks in Hayward, Wisconsin, and Snorkel wood-fired hot tubs to go with them.",
    "sections": [
      {
        "type": "prose-aside",
        "html": "<h3>Nippa</h3>\n<p>The heart of a good sauna is a good stove. The Original Nippa is made to be the strongest and most durable on the market.</p>\n<p>Looking for a hot tub to go with it? See our <a href=\"/wood-fired-hot-tubs/\">wood-fired hot tubs</a>.</p>",
        "aside": [
          {
            "src": "/images/nippa.jpg",
            "alt": "Nippa",
            "width": 320,
            "height": 88,
            "href": "https://nippa.com/"
          }
        ]
      }
    ]
  },
  // Its copy lives in services.ts, and src/app/services/ renders it.
  servicePage,
  {
    "slug": "stoves",
    "title": "Stoves",
    "metaTitle": "Wood & Gas Stoves, Hayward WI",
    "description": "Freestanding wood and gas stoves in many sizes, from Blaze King, Jøtul, HearthStone, Pacific Energy, Kuma and more. In Hayward, WI.",
    "sections": [
      {
        "type": "intro",
        "html": "<p>A stove is a freestanding heating unit that can go just about anywhere in your home.</p>",
        "image": {
          "src": "/images/feature-stoves.jpg",
          "alt": "A wood stove burning on a stone hearth",
          "width": 281,
          "height": 281
        }
      },
      {
        "type": "fuels",
        "heading": "Choose a fuel",
        "intro": "<p>We have a wide variety of stoves in either <a href=\"/stoves/gas-stoves/\">gas</a> or <a href=\"/stoves/wood-stoves/\">wood</a>, in many different sizes to heat large or small spaces.</p>"
      }
    ]
  },
  {
    "slug": "stoves/gas-stoves",
    "title": "Gas Stoves",
    "description": "Gas stoves from Jøtul, Kozy Heat, Blaze King and True North: the warmth of a fire without the upkeep of a wood stove. In Hayward, Wisconsin.",
    "sections": [
      {
        "type": "intro",
        "html": "<p>It’s hard to beat gas for sheer convenience. Perfect for busy people who don’t have time to fuss with the maintenance of a woodstove but still want to appreciate the warmth and ambience a fire brings to your home.</p>"
      },
      {
        "type": "brand",
        "name": "Jøtul",
        "body": "<p>Jotul offers a complete range of both traditional and contemporary stoves and fireplaces. Based on traditions in Norwegian craftsmanship, high quality and consistent use of good design, Jotul will continue to be the favored choice of the generations of today and tomorrow.</p>",
        "logo": {
          "src": "/images/jotul.png",
          "alt": "Jotul",
          "width": 320,
          "height": 149,
          "href": "https://www.jotul.com/products/gas-stoves"
        }
      },
      {
        "type": "brand",
        "name": "Kozy Heat",
        "body": "<p>Kozy Heat freestanding gas stoves are sure to create a warm and inviting atmosphere in any room with ageless beauty only cast iron can deliver.</p>",
        "logo": {
          "src": "/images/kozy-heat.png",
          "alt": "Kozy Heat",
          "width": 320,
          "height": 89,
          "href": "https://www.kozyheat.com/"
        }
      },
      {
        "type": "brand",
        "name": "Blaze King",
        "body": "<p>From the very beginning, Blaze King has focused on one simple idea: design super efficient, eco-friendly hearth products, and build them to last.</p>",
        "logo": {
          "src": "/images/logo-blazeking.jpg",
          "alt": "Blaze King",
          "width": 320,
          "height": 134,
          "href": "https://www.blazeking.com/category/products/gas-stoves/"
        }
      },
      {
        "type": "brand",
        "name": "True North",
        "body": "<p>True North is the economy line from Pacific Energy Fireplace Products, and the range includes a direct-vent gas stove.</p>",
        "logo": {
          "src": "/images/true-north.png",
          "alt": "True North",
          "width": 320,
          "height": 132,
          "href": "https://truenorthstoves.com/"
        },
        "website": "https://truenorthstoves.com/"
      }
    ]
  },
  {
    "slug": "stoves/wood-stoves",
    "title": "Wood Stoves",
    "description": "Wood stoves from Blaze King, Jøtul, HearthStone, Pacific Energy, Morsø, Kuma and True North, at Hayward Stoveworks in Hayward, Wisconsin.",
    "sections": [
      {
        "type": "brand",
        "name": "Pacific Energy",
        "body": "<p>Wood stoves and fireplace inserts that are easy to light, easy to use, economical and clean-burning.</p>",
        "logo": {
          "src": "/images/pacific-energy.png",
          "alt": "Pacific Energy",
          "width": 320,
          "height": 172,
          "href": "https://www.pacificenergy.net/products/wood/"
        }
      },
      {
        "type": "brand",
        "name": "True North",
        "body": "<p>True North is the economy line from Pacific Energy Fireplace Products. Its wood stoves are made in Canada.</p>",
        "logo": {
          "src": "/images/true-north.png",
          "alt": "True North",
          "width": 320,
          "height": 132,
          "href": "https://truenorthstoves.com/"
        },
        "website": "https://truenorthstoves.com/"
      },
      {
        "type": "brand",
        "name": "HearthStone",
        "body": "<p>At HearthStone, they believe that burning wood is one of the most romantic, beautiful and satisfying ways to heat your home. Wood burning can be very economical, while also offering the additional benefits of a beautiful flame, relaxing warmth, and a romantic ambiance.</p>",
        "logo": {
          "src": "/images/HearthStone-Logo.png",
          "alt": "HearthStone Logo",
          "width": 320,
          "height": 59,
          "href": "https://www.hearthstonestoves.com/wood/wood-stoves/"
        }
      },
      {
        "type": "brand",
        "name": "Jøtul",
        "body": "<p>Jotul offers a complete range of both traditional and contemporary stoves and fireplaces. Based on traditions in Norwegian craftsmanship, high quality and consistent use of good design, Jotul will continue to be the favored choice of the generations of today and tomorrow.</p>",
        "logo": {
          "src": "/images/jotul.png",
          "alt": "Jotul",
          "width": 320,
          "height": 149,
          "href": "https://www.jotul.com/products/wood-stoves"
        }
      },
      {
        "type": "brand",
        "name": "Blaze King",
        "body": "<p>From the very beginning, Blaze King has focused on one simple idea: design super efficient, eco-friendly hearth products, and build them to last.</p>",
        "logo": {
          "src": "/images/logo-blazeking.jpg",
          "alt": "Blaze King",
          "width": 320,
          "height": 134,
          "href": "https://www.blazeking.com/category/products/wood-stoves/"
        }
      },
      {
        "type": "brand",
        "name": "Morsø",
        "body": "<p>Morsø has been at the cutting-edge of modern woodstove design since 1853. Its reputation for high-performance, Scandinavian designed cast-iron stoves is world class, as is its “thinking-green” core that continues to innovate environmentally-responsible combustion technology and handcrafted high-quality cast iron products, using 98% recycled material.</p>",
        "logo": {
          "src": "/images/morso.jpg",
          "alt": "Morso",
          "width": 320,
          "height": 130,
          "href": "https://morsoe.com/us/product/indoor/wood-burning-stove"
        }
      },
      {
        "type": "brand",
        "name": "Kuma",
        "body": "<p>Kuma stoves led the way with outside air capable and manufactured home approved oil stoves. Our wood stoves continue to be some of the cleanest burning in the industry, passing the latest 2020 EPA standards. All of our products are laser-cut and handcrafted by each fabricator start to finish – no assembly lines here.</p>",
        "logo": {
          "src": "/images/kuma.png",
          "alt": "Kuma",
          "width": 320,
          "height": 202,
          "href": "https://www.kumastoves.com/Content/Page/wood-stoves"
        }
      }
    ]
  },
  {
    "slug": "wood-fired-hot-tubs",
    "title": "Wood-Fired Hot Tubs",
    "description": "Snorkel wood-fired hot tubs, made in the USA from Western Red Cedar, from Hayward Stoveworks in Hayward, Wisconsin. Nippa sauna stoves too.",
    "sections": [
      {
        "type": "prose-aside",
        "html": "<h3>Snorkel</h3>\n<p>Snorkel Hot Tubs are 100% manufactured in the USA using premium-quality all heart, clear Western Red Cedar from the forests of Canada. Some of our owners say their Snorkel Hot Tub is therapeutic; some say it’s fun, relaxing, economical and revitalizing. Still others say it’s an “experience.” Most people eventually find it’s all these things and more.</p>\n<p>Building a sauna as well? See our <a href=\"/sauna-stoves/\">wood-fired sauna stoves</a>.</p>",
        "aside": [
          {
            "src": "/images/snorkel-hot-tubs-logo.png",
            "alt": "Snorkel Hot Tubs",
            "width": 320,
            "height": 136,
            "href": "https://snorkel.com/"
          }
        ]
      }
    ]
  }
];

export const pageBySlug = new Map(pages.map((p) => [p.slug, p]));
