import React, { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import '../styles/modal.css'

function MenuItemModal({ item, category, onClose, onAddToCart }) {
  const { t } = useLanguage()
  const [quantity, setQuantity] = useState(1)

  const handleAddToCart = () => {
    onAddToCart({
      item,
      category,
      quantity,
      totalPrice: item.price * quantity
    })
    setQuantity(1)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <i className="fa-solid fa-times"></i>
        </button>

        <div className="modal-header">
          <div className="item-status">
            <span className="status-badge available">● {t('available')}</span>
          </div>
        </div>

        <div className="modal-body">
          <h2 className="modal-item-name">{item.item}</h2>
          
          <div className="modal-category">
            <span>{category}</span>
          </div>

          {item.description && (
            <div className="modal-description">
              <h4>{t('description')}</h4>
              <p>{item.description}</p>
            </div>
          )}

          {item.ingredients && (
            <div className="modal-ingredients">
              <h4>{t('ingredients')}</h4>
              <p>{item.ingredients}</p>
            </div>
          )}

          <div className="modal-price-section">
            <h3 className="modal-price">₹{item.price}</h3>
          </div>

          <div className="modal-quantity">
            <label>{t('quantity')}:</label>
            <div className="quantity-control">
              <button 
                className="qty-btn"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <input 
                type="number" 
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
              />
              <button 
                className="qty-btn"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </button>
            </div>
          </div>

          <div className="modal-footer">
            <button className="add-to-cart-btn" onClick={handleAddToCart}>
              <i className="fa-solid fa-plus"></i> {t('addToCart')} (₹{item.price * quantity})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MenuItemModal
