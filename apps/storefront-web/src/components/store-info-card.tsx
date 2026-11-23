"use client";

import {
  addressLine,
  emailHref,
  fulfillmentSummary,
  hoursSummary,
  mapsHref,
  phoneHref,
  SOCIAL_KEYS,
  SOCIAL_LABEL,
  storeOpenStatus,
  whatsappHref,
  type StoreInfo,
} from "@agestyles/api-client/store-info";
import { useEffect, useState } from "react";

/**
 * Public «Información» of a store (AG-55): how it serves orders, hours with «abierto ahora»,
 * contacts, address with a map link and social networks. The page is cached for a few minutes,
 * so «abierto ahora» is worked out in the browser and kept fresh while the page is open.
 */
export function StoreInfoCard({ info }: { info: StoreInfo }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Not during render: the cached page is built on the server, so the clock starts here.
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const status = info.hours && now ? storeOpenStatus(info, now) : null;
  const fulfillment = fulfillmentSummary(info);
  const address = addressLine(info);
  const map = mapsHref(info);
  const hours = hoursSummary(info.hours);
  const socials = SOCIAL_KEYS.filter((key) => info.socials[key]);
  const hasContact = info.phones.length > 0 || Boolean(info.whatsapp) || Boolean(info.email);

  return (
    <section className="wrap store-info" aria-label="Información de la tienda">
      <div className="store-info-head">
        <h2>Información de la tienda</h2>
        <div className="store-info-chips">
          {status ? (
            <span className={`store-chip store-chip-${status.state}`}>{status.label}</span>
          ) : null}
          {info.fulfillment.pickup ? <span className="store-chip">Recogida</span> : null}
          {info.fulfillment.delivery ? <span className="store-chip">Envío a domicilio</span> : null}
        </div>
      </div>
      <div className="store-info-grid">
        {fulfillment ? (
          <div className="store-info-block">
            <h3>Atención</h3>
            <p>{fulfillment}</p>
            {info.fulfillment.delivery_note ? (
              <p className="store-info-muted">{info.fulfillment.delivery_note}</p>
            ) : null}
          </div>
        ) : null}
        {hours.length ? (
          <div className="store-info-block">
            <h3>Horario</h3>
            <ul>
              {hours.map((line) => (
                <li key={line.days}>
                  <span>{line.days}</span> {line.hours}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasContact ? (
          <div className="store-info-block">
            <h3>Contacto</h3>
            <ul>
              {info.phones.map((phone) => (
                <li key={phone}>
                  <a href={phoneHref(phone)}>{phone}</a>
                </li>
              ))}
              {info.whatsapp ? (
                <li>
                  <a href={whatsappHref(info.whatsapp)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </li>
              ) : null}
              {info.email ? (
                <li>
                  <a href={emailHref(info.email)}>{info.email}</a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
        {address ? (
          <div className="store-info-block">
            <h3>Dirección</h3>
            <p>{address}</p>
            {info.address.reference ? (
              <p className="store-info-muted">{info.address.reference}</p>
            ) : null}
            {map ? (
              <a href={map} target="_blank" rel="noopener noreferrer">
                Cómo llegar
              </a>
            ) : null}
          </div>
        ) : null}
        {socials.length ? (
          <div className="store-info-block">
            <h3>Redes sociales</h3>
            <ul>
              {socials.map((key) => (
                <li key={key}>
                  <a href={info.socials[key] as string} target="_blank" rel="noopener noreferrer">
                    {SOCIAL_LABEL[key]}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
