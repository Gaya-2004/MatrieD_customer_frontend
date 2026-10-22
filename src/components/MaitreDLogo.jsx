import React from 'react';
import './MaitreDLogo.css';

export default function MaitreDLogo({ className = '' }) {
  return (
    <div className={`maitred-brand-logo ${className}`}>
      <span className="logo-m-wrapper">
        <span className="logo-letter-m">m</span>
        <svg
          className="logo-smile-svg"
          viewBox="0 0 54 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M 6 5 C 16 19, 38 19, 48 5"
            stroke="#EAA639"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="logo-text-body">aitre</span>
      <span className="logo-letter-d">D</span>
    </div>
  );
}
