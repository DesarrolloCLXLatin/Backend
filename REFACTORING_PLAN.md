# Plan de Refactorización MVC - Backend Node.js

## 📊 Análisis de la Estructura Actual

### Archivos Identificados por Categoría:

#### 🗂️ **ROUTES** (Ya están bien organizados)
- `server/routes/auth.js` ✅
- `server/routes/runners.js` ✅
- `server/routes/payments.js` ✅
- `server/routes/tickets.js` ✅
- `server/routes/dashboard.js` ✅
- `server/routes/inventory.js` ✅
- `server/routes/boxesRoutes.js` ✅
- `server/routes/paymentMethods.js` ✅
- `server/routes/corsSettings.js` ✅
- `server/routes/exchangeRate.js` ✅
- `server/routes/manualPayment.js` ✅
- `server/routes/upload.js` ✅

#### 🔧 **SERVICES** (Necesitan reorganización)
- `server/services/megasoftService.js` → `server/services/payment/MegasoftService.js`
- `server/services/exchangeRateService.js` → `server/services/external/ExchangeRateService.js`
- `server/services/paymentServices.js` → `server/services/payment/PaymentGatewayService.js`
- `server/services/paymentProcessorService.js` → `server/services/payment/PaymentProcessorService.js`

#### 🎛️ **CONTROLLERS** (Extraer de routes)
- Lógica de negocio en routes debe moverse a controllers
- Crear controllers para: Auth, Runners, Payments, Tickets, Dashboard, etc.

#### 📦 **MODELS** (Crear nuevos)
- Crear modelos para interactuar con Supabase
- Abstraer queries de base de datos

#### 🛠️ **UTILS** (Ya organizados, mejorar)
- `server/utils/database.js` ✅
- `server/utils/emailService.js` ✅
- `server/utils/ticketUtils.js` ✅
- `server/utils/captcha.js` ✅
- `server/utils/rateLimiter.js` ✅

#### 🔒 **MIDDLEWARE** (Ya bien organizados)
- `server/middleware/auth.js` ✅
- `server/middleware/cors.js` ✅
- `server/middleware/supabase.js` ✅
- `server/middleware/upload.js` ✅

## 🏗️ Estructura MVC Propuesta

```
server/
├── app.js                          # Configuración principal de Express
├── server.js                       # Punto de entrada del servidor
├── config/                         # Configuraciones
│   ├── database.js                 # Configuración de Supabase
│   ├── cors.js                     # Configuración CORS
│   ├── raceConfig.js              # ✅ Ya existe
│   └── email.js                   # Configuración de email
├── controllers/                    # 🆕 CONTROLADORES
│   ├── AuthController.js
│   ├── RunnersController.js
│   ├── PaymentsController.js
│   ├── TicketsController.js
│   ├── DashboardController.js
│   ├── InventoryController.js
│   ├── BoxesController.js
│   └── UploadController.js
├── models/                         # 🆕 MODELOS
│   ├── User.js
│   ├── Runner.js
│   ├── Payment.js
│   ├── Ticket.js
│   ├── Inventory.js
│   ├── Box.js
│   └── ExchangeRate.js
├── services/                       # 🔄 REORGANIZAR
│   ├── payment/
│   │   ├── MegasoftService.js
│   │   ├── PaymentGatewayService.js
│   │   └── PaymentProcessorService.js
│   ├── external/
│   │   └── ExchangeRateService.js
│   ├── email/
│   │   ├── EmailService.js
│   │   └── TemplateService.js
│   └── ticket/
│       └── TicketService.js
├── routes/                         # ✅ MANTENER (simplificar)
│   ├── auth.js
│   ├── runners.js
│   ├── payments.js
│   ├── tickets.js
│   ├── dashboard.js
│   ├── inventory.js
│   ├── boxes.js
│   └── upload.js
├── middleware/                     # ✅ YA BIEN ORGANIZADOS
├── utils/                          # ✅ MANTENER Y MEJORAR
├── cron/                          # ✅ MANTENER
└── scripts/                       # ✅ MANTENER
```

## 🚀 Plan de Migración Progresiva (8 Fases)

### **FASE 1: Crear Estructura Base** ⭐ (Sin romper nada)
- Crear carpetas `controllers/`, `models/`, reorganizar `services/`
- Mantener archivos originales intactos

### **FASE 2: Crear Modelos Base**
- Abstraer queries de Supabase en modelos
- Mantener compatibilidad con código existente

### **FASE 3: Extraer Controladores de Auth**
- Mover lógica de `routes/auth.js` a `AuthController.js`
- Actualizar rutas para usar controladores

### **FASE 4: Extraer Controladores de Runners**
- Mover lógica de `routes/runners.js` a `RunnersController.js`

### **FASE 5: Extraer Controladores de Payments**
- Mover lógica de `routes/payments.js` a `PaymentsController.js`

### **FASE 6: Extraer Controladores de Tickets**
- Mover lógica de `routes/tickets.js` a `TicketsController.js`

### **FASE 7: Reorganizar Services**
- Mover services a subcarpetas especializadas
- Actualizar imports

### **FASE 8: Optimización Final**
- Limpiar código duplicado
- Optimizar imports y dependencias

## ✅ Checklist de Validación

### Después de cada fase:
- [ ] `npm run server:dev` inicia sin errores
- [ ] Todas las rutas responden correctamente
- [ ] Tests de endpoints críticos pasan
- [ ] No hay imports rotos
- [ ] Logs no muestran errores de dependencias

### Tests específicos:
```bash
# Test de endpoints críticos
curl http://localhost:30500/api/health
curl http://localhost:30500/api/auth/verify
curl http://localhost:30500/api/runners
curl http://localhost:30500/api/tickets/inventory
```

## 🎯 Beneficios Esperados

1. **Separación de Responsabilidades**: Lógica de negocio separada de rutas
2. **Reutilización**: Controladores y servicios reutilizables
3. **Testabilidad**: Cada componente es testeable independientemente
4. **Mantenibilidad**: Código más fácil de mantener y extender
5. **Escalabilidad**: Estructura preparada para crecimiento

## 📝 Notas Importantes

- **NO eliminar archivos existentes** hasta confirmar que todo funciona
- **Mantener imports existentes** durante la transición
- **Usar alias de imports** para facilitar la migración
- **Validar cada paso** antes de continuar al siguiente
- **Hacer backup** antes de cada fase mayor

---

¿Quieres que comience con la **FASE 1** creando la estructura base?