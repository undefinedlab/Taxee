# Graph Report - /home/dev/devOPS/taxee  (2026-05-23)

## Corpus Check
- Corpus is ~45,220 words - fits in a single context window. You may not need a graph.

## Summary
- 1027 nodes · 1302 edges · 59 communities (50 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.79)
- Token cost: 5,000 input · 3,500 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Dashboard UI Components|Dashboard UI Components]]
- [[_COMMUNITY_Landing Page Components|Landing Page Components]]
- [[_COMMUNITY_Core Tax System Concepts|Core Tax System Concepts]]
- [[_COMMUNITY_Heartbeat & Execution Engine|Heartbeat & Execution Engine]]
- [[_COMMUNITY_Action Types & Reasoning|Action Types & Reasoning]]
- [[_COMMUNITY_Core Dependencies|Core Dependencies]]
- [[_COMMUNITY_Asset Correlations|Asset Correlations]]
- [[_COMMUNITY_Database Schema & Client|Database Schema & Client]]
- [[_COMMUNITY_Agent State Management|Agent State Management]]
- [[_COMMUNITY_Tax Engine Strategies|Tax Engine Strategies]]
- [[_COMMUNITY_Worker Dependencies|Worker Dependencies]]
- [[_COMMUNITY_Validation Schemas|Validation Schemas]]
- [[_COMMUNITY_API Dependencies|API Dependencies]]
- [[_COMMUNITY_Turborepo Pipeline|Turborepo Pipeline]]
- [[_COMMUNITY_Package Configuration|Package Configuration]]
- [[_COMMUNITY_Smart Contract Types|Smart Contract Types]]
- [[_COMMUNITY_Contract ABIs|Contract ABIs]]
- [[_COMMUNITY_Test Suite|Test Suite]]
- [[_COMMUNITY_Agent Router|Agent Router]]
- [[_COMMUNITY_Aggregation Pipeline|Aggregation Pipeline]]
- [[_COMMUNITY_Compliance Engine|Compliance Engine]]
- [[_COMMUNITY_Execution Services|Execution Services]]
- [[_COMMUNITY_LLM Services|LLM Services]]
- [[_COMMUNITY_Notification Services|Notification Services]]
- [[_COMMUNITY_Shared Types & Utils|Shared Types & Utils]]
- [[_COMMUNITY_Tax Engine Core|Tax Engine Core]]
- [[_COMMUNITY_Configuration|Configuration]]
- [[_COMMUNITY_Opportunity Router|Opportunity Router]]
- [[_COMMUNITY_Lot Management|Lot Management]]
- [[_COMMUNITY_Regime Classification|Regime Classification]]
- [[_COMMUNITY_Database Migrations|Database Migrations]]
- [[_COMMUNITY_Policy Management|Policy Management]]
- [[_COMMUNITY_Wallet Integration|Wallet Integration]]
- [[_COMMUNITY_User Router|User Router]]
- [[_COMMUNITY_Opportunity Service|Opportunity Service]]
- [[_COMMUNITY_Telegram Bot Commands|Telegram Bot Commands]]
- [[_COMMUNITY_MCP Server Tools|MCP Server Tools]]
- [[_COMMUNITY_Indexer Service|Indexer Service]]
- [[_COMMUNITY_Price Service|Price Service]]
- [[_COMMUNITY_WebSocket Server|WebSocket Server]]
- [[_COMMUNITY_Prompts & Templates|Prompts & Templates]]
- [[_COMMUNITY_Circle Integration|Circle Integration]]
- [[_COMMUNITY_CCTP Bridge|CCTP Bridge]]
- [[_COMMUNITY_Gas Abstraction|Gas Abstraction]]
- [[_COMMUNITY_Database Schema|Database Schema]]
- [[_COMMUNITY_Contract Interfaces|Contract Interfaces]]
- [[_COMMUNITY_ERC20 Contracts|ERC20 Contracts]]
- [[_COMMUNITY_Uniswap Integration|Uniswap Integration]]
- [[_COMMUNITY_Superform Integration|Superform Integration]]
- [[_COMMUNITY_Moonwell Integration|Moonwell Integration]]
- [[_COMMUNITY_Stargate Bridge|Stargate Bridge]]
- [[_COMMUNITY_Arc Chain Contracts|Arc Chain Contracts]]
- [[_COMMUNITY_Script Utilities|Script Utilities]]
- [[_COMMUNITY_Development Scripts|Development Scripts]]
- [[_COMMUNITY_Contract Scripts|Contract Scripts]]
- [[_COMMUNITY_IDE Configuration|IDE Configuration]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 19 edges
2. `runHeartbeat()` - 17 edges
3. `CircleClient` - 17 edges
4. `compilerOptions` - 16 edges
5. `cn()` - 15 edges
6. `pairs` - 12 edges
7. `scripts` - 11 edges
8. `computeRebalanceCandidates()` - 11 edges
9. `Taxee System` - 11 edges
10. `scripts` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Turborepo` --semantically_similar_to--> `PostgreSQL`  [INFERRED] [semantically similar]
  README.md → backend/docker-compose.yml
- `Turborepo` --semantically_similar_to--> `Redis`  [INFERRED] [semantically similar]
  README.md → backend/docker-compose.yml
- `Execution Layer (Circle Stack)` --conceptually_related_to--> `TaxeeExecutor`  [INFERRED]
  architecture.md → contracts/README.md
- `cn()` --calls--> `clsx`  [INFERRED]
  frontend/lib/utils.ts → frontend/package.json
- `Taxee System` --conceptually_related_to--> `Claude API`  [EXTRACTED]
  architecture.md → status.md

## Hyperedges (group relationships)
- **Tax Optimization Decision Pipeline** — component_data_aggregator, component_llm_regime_classifier, component_decision_engine, component_llm_action_reasoner, component_execution_layer, component_arc_ledger [EXTRACTED 1.00]
- **User Lifecycle Phases** — user_lifecycle_onboarding, user_lifecycle_heartbeat, user_lifecycle_action_loop [EXTRACTED 1.00]
- **Approval Mode Options** — approval_mode_manual, approval_mode_delegated [EXTRACTED 1.00]
- **Deployment Mode Options** — deployment_mode_hosted, deployment_mode_mcp [EXTRACTED 1.00]
- **Decision Engine Components** — strategy_harvest, strategy_rebalance, strategy_park, lot_selection_hifo [EXTRACTED 1.00]
- **Core Design Principles** — design_principle_tax_first_class, design_principle_lots_unit_truth, design_principle_code_llm_split [EXTRACTED 1.00]
- **Circle Stack Integration** — external_circle_wallets, external_cctp, external_usyc, external_paymaster [EXTRACTED 1.00]
- **Deployed Smart Contracts** — contract_taxee_lot_registry, contract_taxee_executor, arc_chain_testnet [EXTRACTED 1.00]
- **Backend Infrastructure Stack** — infrastructure_postgres, infrastructure_redis, infrastructure_fastify, infrastructure_turborepo [INFERRED 0.80]
- **Key Custody Tier Options** — key_custody_watch_tier, key_custody_execute_tier [EXTRACTED 1.00]

## Communities (59 total, 9 thin omitted)

### Community 0 - "Dashboard UI Components"
Cohesion: 0.06
Nodes (63): PageProps, ApprovalModeToggle(), ApprovalModeToggleProps, DashboardClient(), DashboardClientProps, MetricCard(), MetricsGrid(), MetricsGridProps (+55 more)

### Community 1 - "Landing Page Components"
Cohesion: 0.05
Nodes (30): AnalyticsCard(), CollaborationStrip(), partners, FeatureCard(), FeatureCardProps, HeroProfileMenu(), HeroTopBar(), approvalModes (+22 more)

### Community 2 - "Core Tax System Concepts"
Cohesion: 0.06
Nodes (44): Delegated Approval Mode, Manual Approval Mode, Arc Testnet (Chain 5042002), Arc Ledger, Data Aggregator, Decision Engine, Execution Layer (Circle Stack), LLM Action Reasoner (+36 more)

### Community 3 - "Heartbeat & Execution Engine"
Cohesion: 0.08
Nodes (30): bridgeUsdcViaCctp(), CCTP_DOMAIN, CctpBridgeParams, CctpBridgeResult, MESSAGE_SENT_ABI, MESSAGE_TRANSMITTER_ABI, VIEM_CHAINS, ChainConfig (+22 more)

### Community 4 - "Action Types & Reasoning"
Cohesion: 0.05
Nodes (39): ActionDecisionRequest, ActionReasonerOutput, ActionReceipt, ActionType, Agent, AgentStatus, ApprovalMode, ApprovalSettings (+31 more)

### Community 5 - "Core Dependencies"
Cohesion: 0.05
Nodes (37): dependencies, drizzle-orm, ethers, fastify, @fastify/cors, @fastify/jwt, postgres, siwe (+29 more)

### Community 6 - "Asset Correlations"
Cohesion: 0.05
Nodes (36): correlation, replacement, correlation, replacement, correlation, replacement, correlation, replacement (+28 more)

### Community 7 - "Database Schema & Client"
Cohesion: 0.08
Nodes (24): app, port, reset(), actionRoutes(), agentRoutes(), authRoutes(), lotRoutes(), portfolioRoutes() (+16 more)

### Community 8 - "Agent State Management"
Cohesion: 0.06
Nodes (29): agent, agentById, agentIds, alreadyLinked, amt, arg, BACKEND_DIR, blocks (+21 more)

### Community 9 - "Tax Engine Strategies"
Cohesion: 0.14
Nodes (25): computeHarvestPriority(), computeWashSaleDaysRemaining(), CorrelationData, estimateGasCost(), generateCandidateId(), getReplacementAsset(), scanForHarvestOpportunities(), estimateTaxCost() (+17 more)

### Community 10 - "Worker Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, drizzle-orm, node-cron, postgres, @taxee/aggregator, @taxee/compliance, @taxee/db, @taxee/execution (+20 more)

### Community 11 - "Validation Schemas"
Cohesion: 0.07
Nodes (25): ActionDecisionInput, ActionDecisionSchema, ActionReasonerOut, ActionReasonerOutputSchema, ActionTypeSchema, AgentStatusSchema, ApprovalModeSchema, ApprovalSettingsSchema (+17 more)

### Community 12 - "API Dependencies"
Cohesion: 0.08
Nodes (23): dependencies, drizzle-orm, fastify, @fastify/cors, @taxee/aggregator, @taxee/db, @taxee/shared, @taxee/tax-engine (+15 more)

### Community 13 - "Turborepo Pipeline"
Cohesion: 0.08
Nodes (23): dependsOn, outputs, cache, cache, cache, cache, cache, persistent (+15 more)

### Community 14 - "Package Configuration"
Cohesion: 0.09
Nodes (23): dependencies, axios, drizzle-orm, @taxee/aggregator, @taxee/compliance, @taxee/db, @taxee/shared, viem (+15 more)

### Community 15 - "Smart Contract Types"
Cohesion: 0.08
Nodes (23): dependencies, clsx, next, react, react-dom, devDependencies, eslint, eslint-config-next (+15 more)

### Community 16 - "Contract ABIs"
Cohesion: 0.08
Nodes (23): dependencies, axios, drizzle-orm, grammy, @taxee/aggregator, @taxee/db, @taxee/execution, @taxee/notifications (+15 more)

### Community 17 - "Test Suite"
Cohesion: 0.09
Nodes (22): devDependencies, prettier, turbo, @types/node, typescript, engines, node, pnpm (+14 more)

### Community 18 - "Agent Router"
Cohesion: 0.09
Nodes (22): dependencies, drizzle-orm, postgres, devDependencies, drizzle-kit, @types/node, typescript, exports (+14 more)

### Community 19 - "Aggregation Pipeline"
Cohesion: 0.09
Nodes (22): dependencies, @taxee/shared, devDependencies, jest, ts-jest, @types/jest, typescript, exports (+14 more)

### Community 20 - "Compliance Engine"
Cohesion: 0.21
Nodes (12): ACTION_REASONER_USER(), EXPLANATION_GENERATOR_USER(), GOAL_PARSER_USER(), REGIME_CLASSIFIER_USER(), reasonAboutAction(), generateExplanation(), parseGoal(), callLLM() (+4 more)

### Community 21 - "Execution Services"
Cohesion: 0.10
Nodes (20): compilerOptions, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes, lib, module, moduleResolution (+12 more)

### Community 22 - "LLM Services"
Cohesion: 0.11
Nodes (19): dependencies, axios, @taxee/shared, viem, devDependencies, typescript, exports, import (+11 more)

### Community 23 - "Notification Services"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 24 - "Shared Types & Utils"
Cohesion: 0.11
Nodes (19): dependencies, @anthropic-ai/sdk, @taxee/shared, zod, devDependencies, typescript, exports, import (+11 more)

### Community 25 - "Tax Engine Core"
Cohesion: 0.11
Nodes (19): dependencies, axios, grammy, @taxee/shared, devDependencies, typescript, exports, import (+11 more)

### Community 26 - "Configuration"
Cohesion: 0.11
Nodes (18): dependencies, @taxee/shared, @taxee/tax-engine, devDependencies, typescript, exports, import, main (+10 more)

### Community 27 - "Opportunity Router"
Cohesion: 0.11
Nodes (18): dependencies, zod, devDependencies, typescript, exports, import, main, name (+10 more)

### Community 29 - "Regime Classification"
Cohesion: 0.26
Nodes (11): CircleBalance, CircleBlockchain, CircleEnvironment, CircleTransactionResult, CircleWallet, CircleProvisioningResult, provisionCircleWallet(), ProvisionedWallet (+3 more)

### Community 30 - "Database Migrations"
Cohesion: 0.17
Nodes (11): app, port, agentId, assetIds, candidates, now, policy, positionMap (+3 more)

### Community 31 - "Policy Management"
Cohesion: 0.20
Nodes (10): main(), AlchemyTransfer, fetchInboundTransfers(), GECKO_ID, getHistoricalPrice(), ImportedLot, importLotsForWallet(), NETWORKS (+2 more)

### Community 32 - "Wallet Integration"
Cohesion: 0.25
Nodes (6): geistMono, geistSans, inter, metadata, playfair, ThemeScript()

### Community 33 - "User Router"
Cohesion: 0.28
Nodes (8): alchemyCall(), fetchCurrentPrices(), fetchWalletPositions(), GECKO_ID, KNOWN_TOKENS, NETWORKS, STABLES, TokenPosition

### Community 34 - "Opportunity Service"
Cohesion: 0.39
Nodes (8): collectRegimeSignals(), computeEthBtcTrend(), computeRealizedVol(), computeStablecoinSupplyDelta(), fetchBtcFundingRate(), fetchFearAndGreedIndex(), fetchPrices7dHistory(), PriceHistory

### Community 35 - "Telegram Bot Commands"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 36 - "MCP Server Tools"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 37 - "Indexer Service"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 38 - "Price Service"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 39 - "WebSocket Server"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 40 - "Prompts & Templates"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 41 - "Circle Integration"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 42 - "CCTP Bridge"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 43 - "Gas Abstraction"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 44 - "Database Schema"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 46 - "ERC20 Contracts"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 47 - "Uniswap Integration"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 48 - "Superform Integration"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### Community 49 - "Moonwell Integration"
Cohesion: 0.67
Nodes (3): daysAgo(), main(), now

## Knowledge Gaps
- **573 isolated node(s):** `config`, `nextConfig`, `name`, `version`, `private` (+568 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runHeartbeat()` connect `Heartbeat & Execution Engine` to `Opportunity Service`, `Tax Engine Strategies`, `Compliance Engine`, `Regime Classification`, `Policy Management`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `scanForHarvestOpportunities()` connect `Tax Engine Strategies` to `Heartbeat & Execution Engine`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `runHeartbeat()` (e.g. with `importLotsForWallet()` and `fetchPrices()`) actually correct?**
  _`runHeartbeat()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `config`, `nextConfig`, `name` to the rest of the system?**
  _573 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.057512797350195724 - nodes in this community are weakly interconnected._
- **Should `Landing Page Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05454545454545454 - nodes in this community are weakly interconnected._
- **Should `Core Tax System Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.06236786469344609 - nodes in this community are weakly interconnected._