# BOW AGENT V3.3 — INTERFACE CONTRACTS & BOUNDARY ARCHITECTURE

## 1. Why These Contracts Exist

Historically, the BOW Agent was built as an embedded module inside `shopofbow` (`C:\BOW\shopofbow`). As a result, certain parts of the Agent directly imported the Supabase client (`import { supabase } from '../../lib/supabase'`), assumed specific PostgreSQL tables, and dispatched browser DOM events to open React modals (`CheckoutModal`, `DepositModal`).

To prepare the Agent for extraction into a standalone intelligence package (`C:\BOW\bow-agent`) that can serve both `shopofbow` and physical/simulated robots (`C:\BOW\bow-robot`), we introduce explicit interface contracts.

### The Immutable Dependency Rule:
> **"Agent Core depends on contracts, never on Shop implementations."**

---

## 2. Current vs Target Architecture

### Current (Embedded Monolith)
```
[ shopofbow React UI ]
        ↓
[ embedded agentEngine ] ──(direct import)──> [ Supabase Client / Local DB ]
```

### Target (Decoupled Autonomous Intelligence)
```
+-------------------------------------------------------------+
|                      C:\BOW\shopofbow                       |
|                 (E-commerce Web Application)                |
+-------------------------------------------------------------+
                              |
                              | ShopAdapter (Catalog, Orders, Wallets, Modals)
                              v
+-------------------------------------------------------------+
|                      C:\BOW\bow-agent                       |
|                  (Autonomous Intelligence Core)             |
|                                                             |
|  +---------------------+  +-------------------------------+ |
|  | AI Runtime Pipeline |  | Knowledge & Governance Engine | |
|  +---------------------+  +-------------------------------+ |
|  | Production Runtime  |  | Memory & Session Context      | |
|  | (Circuit/SLO/Scale) |  |                               | |
|  +---------------------+  +-------------------------------+ |
|  | Semantic Actions    |  | RobotAdapter (Abstraction)    | |
|  +---------------------+  +-------------------------------+ |
+-------------------------------------------------------------+
                              |
                              | RobotAdapter (Hardware, Actuators, Telemetry)
                              v
+-------------------------------------------------------------+
|                      C:\BOW\bow-robot                       |
|             (Robotics Hardware & Embedded Control)          |
|                                                             |
|   Sensors | Motors | Camera | Microphone | Speaker | Actuator|
+-------------------------------------------------------------+
```

---

## 3. Contract Classification

### 3.1. Contracts Owned by Agent Core (`C:\BOW\bow-agent`)
These contracts define what the Agent needs from any host environment:
1. **`ActionHandler`** (`actionHandler.ts`): Semantic agent actions (`NAVIGATE_CHECKOUT`, `NAVIGATE_ORDER_DETAIL`, etc.) detached from React/DOM.
2. **`CatalogProvider`** (`catalogProvider.ts`): Product, plan, and category lookup abstraction.
3. **`OrderProvider`** (`orderProvider.ts`): Order history and warranty verification abstraction.
4. **`WalletProvider`** (`walletProvider.ts`): Balance lookup and bank deposit instructions.
5. **`KnowledgeProvider`** (`knowledgeProvider.ts`): FAQ and negative policy search abstraction.
6. **`AnalyticsProvider`** (`analyticsProvider.ts`): Telemetry event recording abstraction.
7. **`StorageAdapter`** (`storageAdapter.ts`): Domain-oriented persistence contract hiding SQL/Supabase.
8. **`LlmProvider`** (`llmProvider.ts`): Upstream LLM provider abstraction (Gemini, Claude, local models).
9. **`ShopAdapter`** (`shopAdapter.ts`): Composite host boundary for e-commerce shops.

### 3.2. Interfaces Reserved for Robot (`C:\BOW\bow-robot`)
- **`RobotAdapter`** (`robotAdapter.ts`):
  - Semantic commands: `speak()`, `listen()`, `move()`, `stop()`, `getSensorState()`.
  - Hides low-level hardware: GPIO, PWM, motor drivers, I2C, SPI, camera frames, and microphone audio streams.

### 3.3. Implementations Belonging to Shop (`C:\BOW\shopofbow`)
The following belong strictly inside `shopofbow` and will implement the contracts:
- `ShopAdapterImpl`: Concrete implementation binding `StorageAdapter` to Supabase.
- `ShopActionHandler`: Concrete handler dispatching React state or browser events to open `CheckoutModal`, `DepositModal`, etc.

---

## 4. Forbidden Imports in Agent Core

The Agent Core (`C:\BOW\bow-agent`) must **NEVER** import:
1. ❌ **React or DOM APIs**: `react`, `react-dom`, `window.dispatchEvent`, `document.*`.
2. ❌ **Shop UI Modals**: `CheckoutModal`, `UserOrderDetailModal`, `DepositModal`, `CreateTicketModal`.
3. ❌ **Concrete Database Clients**: `lib/supabase`, `createClient`, or direct SQL drivers.
4. ❌ **Shop Filesystem Paths**: Absolute paths to `c:\Web\shopofbow` or `c:\BOW\shopofbow`.
5. ❌ **Shop Authentication State**: Direct access to `AuthContext` (the host must pass sanitized `AgentContext`).
