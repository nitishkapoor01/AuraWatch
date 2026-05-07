import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, image, url, type = 'website', schema, noIndex = false, keywords }) => {
  const siteName = 'AuraWatch Fun';
  const defaultTitle = 'AuraWatch Fun - Free Movies & TV Shows in HD | AuraWatch';
  const defaultDescription = 'Watch and download the latest movies and TV shows in 1080p on AuraWatch Fun. Free, fast, and no buffering on AuraWatch!';
  const defaultImage = 'https://www.aurawatch.fun/favicon.png'; // Absolute URL for social previews
  const defaultKeywords = 'aurawatch, aurawatch fun, aurawatchfun movies, free movies, download movies, watch tv shows, hd movies online, aurawatch movies';
  
  const currentUrl = typeof window !== 'undefined' ? window.location.href : (url || 'https://www.aurawatch.fun');
  
  const seo = {
    title: title ? `${title} | ${siteName}` : defaultTitle,
    description: description || defaultDescription,
    image: image || defaultImage,
    url: currentUrl,
    keywords: keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords
  };

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="keywords" content={seo.keywords} />
      <link rel="canonical" href={seo.url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph / Facebook / Telegram / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
      <meta name="twitter:site" content="@AuraWatch" />
      
      {/* Additional SEO */}
      <meta name="theme-color" content="#e50914" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      
      {/* Schema.org Structured Data */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
