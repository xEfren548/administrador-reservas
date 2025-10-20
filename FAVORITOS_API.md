# API de Favoritos para Clientes Web

## 🎯 **Funcionalidad Implementada**

Sistema completo para que los clientes web puedan marcar cabañas como favoritas mediante un corazón en el frontend.

## 📋 **Endpoints Disponibles**

### **Base URL:** `http://localhost:3005`
### **Autenticación:** Todas las rutas requieren JWT en header `Authorization: Bearer <token>`

---

## 🔥 **Endpoints Principales**

### **1. Toggle Favorito (Recomendado para el corazón)**
```http
POST /client/favorites/toggle
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
    "accommodationId": "507f1f77bcf86cd799439011"
}
```

**Respuesta:**
```json
{
    "success": true,
    "message": "Cabaña agregada a favoritos",
    "data": {
        "action": "added",  // "added" o "removed"
        "isFavorite": true,
        "favoriteAccommodations": ["507f1f77bcf86cd799439011"],
        "totalFavorites": 1
    }
}
```

---

### **2. Agregar a Favoritos**
```http
POST /client/favorites
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
    "accommodationId": "507f1f77bcf86cd799439011"
}
```

**Respuesta:**
```json
{
    "success": true,
    "message": "Cabaña agregada a favoritos exitosamente",
    "data": {
        "favoriteAccommodations": ["507f1f77bcf86cd799439011"],
        "totalFavorites": 1
    }
}
```

---

### **3. Remover de Favoritos**
```http
DELETE /client/favorites/507f1f77bcf86cd799439011
Authorization: Bearer <jwt_token>
```

**Respuesta:**
```json
{
    "success": true,
    "message": "Cabaña removida de favoritos exitosamente",
    "data": {
        "favoriteAccommodations": [],
        "totalFavorites": 0
    }
}
```

---

### **4. Obtener Todos los Favoritos**
```http
GET /client/favorites
Authorization: Bearer <jwt_token>
```

**Respuesta:**
```json
{
    "success": true,
    "data": {
        "favoriteAccommodations": [
            {
                "_id": "507f1f77bcf86cd799439011",
                "nombre": "Cabaña del Bosque",
                "descripcion": "Hermosa cabaña...",
                "precio": 2500,
                // ... más datos de la cabaña
            }
        ],
        "totalFavorites": 1
    }
}
```

---

### **5. Verificar si es Favorito**
```http
GET /client/favorites/check/507f1f77bcf86cd799439011
Authorization: Bearer <jwt_token>
```

**Respuesta:**
```json
{
    "success": true,
    "data": {
        "isFavorite": true,
        "accommodationId": "507f1f77bcf86cd799439011"
    }
}
```

---

## 💡 **Implementación en Frontend**

### **Botón de Corazón con Toggle**

```javascript
// Función para toggle favorito
const toggleFavorite = async (accommodationId) => {
    try {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch('/client/favorites/toggle', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ accommodationId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Actualizar UI basado en data.data.isFavorite
            updateHeartIcon(data.data.isFavorite);
            showNotification(data.message);
        }
        
    } catch (error) {
        console.error('Error al toggle favorito:', error);
    }
};

// Actualizar ícono de corazón
const updateHeartIcon = (isFavorite) => {
    const heartIcon = document.querySelector('.heart-icon');
    
    if (isFavorite) {
        heartIcon.classList.add('favorite'); // Corazón lleno/rojo
        heartIcon.innerHTML = '❤️';
    } else {
        heartIcon.classList.remove('favorite'); // Corazón vacío
        heartIcon.innerHTML = '🤍';
    }
};

// Event listener para el corazón
document.querySelector('.heart-button').addEventListener('click', () => {
    const accommodationId = document.querySelector('[data-accommodation-id]').dataset.accommodationId;
    toggleFavorite(accommodationId);
});
```

### **Verificar Estado Inicial**

```javascript
// Verificar si una cabaña es favorita al cargar la página
const checkFavoriteStatus = async (accommodationId) => {
    try {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`/client/favorites/check/${accommodationId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateHeartIcon(data.data.isFavorite);
        }
        
    } catch (error) {
        console.error('Error al verificar favorito:', error);
    }
};

// Llamar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const accommodationId = document.querySelector('[data-accommodation-id]').dataset.accommodationId;
    checkFavoriteStatus(accommodationId);
});
```

### **Lista de Favoritos**

```javascript
// Obtener y mostrar favoritos del usuario
const loadFavorites = async () => {
    try {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch('/client/favorites', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            renderFavoritesList(data.data.favoriteAccommodations);
        }
        
    } catch (error) {
        console.error('Error al cargar favoritos:', error);
    }
};

const renderFavoritesList = (favorites) => {
    const container = document.querySelector('#favorites-container');
    
    if (favorites.length === 0) {
        container.innerHTML = '<p>No tienes cabañas favoritas aún</p>';
        return;
    }
    
    container.innerHTML = favorites.map(accommodation => `
        <div class="favorite-item" data-accommodation-id="${accommodation._id}">
            <h3>${accommodation.nombre}</h3>
            <p>${accommodation.descripcion}</p>
            <p>Precio: $${accommodation.precio}</p>
            <button onclick="toggleFavorite('${accommodation._id}')" class="remove-favorite">
                Remover de favoritos
            </button>
        </div>
    `).join('');
};
```

---

## 🛡️ **Validaciones Implementadas**

- ✅ **JWT válido** requerido para todas las operaciones
- ✅ **accommodationId** debe ser un ObjectId válido de MongoDB
- ✅ **Verificación de duplicados** al agregar favoritos
- ✅ **Verificación de existencia** al remover favoritos
- ✅ **Manejo de errores** completo

## 📊 **Respuestas de Error**

### **Sin autenticación:**
```json
{
    "success": false,
    "message": "Token de acceso requerido"
}
```

### **ID inválido:**
```json
{
    "success": false,
    "message": "Datos de registro inválidos",
    "errors": [
        {
            "msg": "ID de cabaña debe ser un ObjectId válido",
            "param": "accommodationId"
        }
    ]
}
```

### **Ya es favorito:**
```json
{
    "success": false,
    "message": "Esta cabaña ya está en tus favoritos"
}
```

### **No es favorito:**
```json
{
    "success": false,
    "message": "Esta cabaña no está en tus favoritos"
}
```

---

## 🎨 **Ejemplo de CSS para el Corazón**

```css
.heart-button {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    transition: transform 0.2s ease;
}

.heart-button:hover {
    transform: scale(1.1);
}

.heart-icon {
    transition: all 0.3s ease;
}

.heart-icon.favorite {
    color: #ff4757;
    animation: heartbeat 0.6s ease-in-out;
}

@keyframes heartbeat {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
}
```

---

## 🎯 **Casos de Uso**

1. **Usuario hace click en corazón** → `POST /client/favorites/toggle`
2. **Cargar página de cabaña** → `GET /client/favorites/check/:id`
3. **Página de favoritos del usuario** → `GET /client/favorites`
4. **Remover favorito específico** → `DELETE /client/favorites/:id`

**¡El sistema está completamente funcional y listo para usar!** 🚀