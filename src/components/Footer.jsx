import React from 'react'
import { useLanguage } from '../context/LanguageContext'
import '../styles/components.css'
const chefMascotImg = `/assets/images/chef_mascot.png`;

function Footer() {
  const { t } = useLanguage()
  return (
    <footer className="footer">
      <div className="mascot-container">
        <img src={chefMascotImg} alt="Chef Mascot" className="chef-mascot" />
      </div>
    </footer>
  )
}

export default Footer
