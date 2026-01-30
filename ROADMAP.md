# 🗺️ Smart Fitness Mirror - Roadmap

Strategic plan to achieve the goals outlined in the README.md. This roadmap is organized by architectural layers and feature priority.

---

## 📊 Project Status Overview

**Current State:**

- ✅ Pose detection pipeline (MoveNet)
- ✅ Camera streaming & canvas rendering
- ✅ Basic UI routing structure
- ✅ PouchDB foundation for local storage
- ⏳ Exercise validation (partially architectured)
- ⏳ Real-time visualization
- ❌ Menu functionality
- ❌ Settings interface
- ❌ Exercise recording & scoring
- ❌ Ghost pose comparison

---

## 🎯 Phase 1: Foundation & Core Architecture (Weeks 1-2)

### 1.1 Exercise Definition System

- [] **Define Exercise JSON Schema**
  - Versioning system for exercises
  - Signal definitions (angles, body segments)
  - Event graph structure validation
  - Temporal constraints specification
  - Completion criteria

- [] **Exercise Manager Service**
  - Load exercises from JSON files (`/src/db/exercises/*.json`)
  - Validate exercise definitions against schema
  - Migrate exercises to PouchDB
  - Version tracking and migration utilities

- [ ] **Test Samples**
  - Create 3-5 exercise templates for testing
  - Include: squats, push-ups, arm raises, leg exercises

### 1.2 Angle Calculation Engine

- [ ] **KeyPoint Utilities**
  - Extract specific keypoints from pose output
  - Confidence filtering
  - Normalize coordinates to canvas space

- [ ] **Angle Calculator**
  - Calculate joint angles from 3 keypoints
  - Handle edge cases (out-of-frame, low confidence)
  - Cache calculations for performance
  - Unit tests for accuracy

---

## 🧠 Phase 2: Validation Engine (Weeks 3-4)

### 2.1 Finite State Machine (FSM)

- [ ] **FSM State Management**
  - Implement states: IDLE, IN_PROGRESS, FAILED, COMPLETED
  - State transition rules
  - Event handlers for state changes
  - Validation error tracking

- [ ] **FSM Executor**
  - Initialize FSM from exercise definition
  - Update FSM on each pose detection
  - Track FSM state history (for debugging)
  - Timeout handling

### 2.2 Event Graph Engine

- [ ] **Graph Data Structure**
  - Node representation (ID, signal, range, hold_ms, emit flag)
  - Edge representation (from/to nodes)
  - Sync node support (wait for multiple paths)

- [ ] **Graph Evaluator**
  - Determine active nodes
  - Evaluate signal ranges
  - Track temporal hold periods
  - Advance graph on rule satisfaction

- [ ] **Parallel Movement Support**
  - Multiple simultaneous paths
  - Progress tracking per path
  - Convergence detection

### 2.3 Temporal Constraints

- [ ] **Constraint Evaluator**
  - Check time windows between nodes (min_ms, max_ms)
  - Severity handling (hard/soft constraints)
  - Constraint violation reporting

- [ ] **Temporal Tracking**
  - Record timestamps for node completions
  - Calculate time deltas
  - Adjust scoring based on timing

### 2.4 Exercise Validator

- [ ] **High-level Validator**
  - Orchestrate FSM, graph, and temporal logic
  - Return completion status
  - Provide detailed validation feedback
  - Performance profiling

---

## 🎨 Phase 3: Visualization & Rendering (Weeks 5-6)

### 3.1 Ghost Pose System

- [ ] **Ghost Model**
  - Store reference/ideal pose from exercise
  - Render ghost skeleton on canvas
  - Configurable opacity/color

- [ ] **Ghost Pose Loader**
  - Extract ghost pose from exercise definition
  - Handle multiple phases (start, middle, end)
  - Blend between poses for smooth transitions

### 3.2 Comparison Visualization

- [ ] **Angle Visualization**
  - Overlay current vs target angles
  - Color code progress (red/yellow/green)
  - Display numeric values

- [ ] **Joint Alignment**
  - Draw connections between user and ghost joints
  - Show deviation vectors
  - Highlight problem areas

- [ ] **Feedback Layers**
  - Success indicators
  - Warning/error messages
  - Compensation suggestions

### 3.3 Real-time Canvas Updates

- [ ] **Optimize Drawing Performance**
  - Batch render operations
  - Only redraw changed elements
  - Frame rate limiting (30-60 FPS target)

- [ ] **Multi-layer Rendering**
  - Background (video feed)
  - Ghost skeleton
  - User skeleton
  - Angle overlays
  - Text/UI elements
  - Effects (success confetti, error states)

---

## 📱 Phase 4: User Interface (Weeks 7-8)

### 4.1 Menu System

- [x] **Exercise Selection**
  - List all available exercises
  - Filter by difficulty, muscle groups, search
  - Each card should have title, description, difficulty, muscle groups, instructions
  - Each card should have an add button to routine and number of times to do it
  - infinite scroll for large lists
  - The routine should be a side panel that can be opened / hidden from the menu
  - The routine should have a delete button to remove exercises from it
  - The cards in the routine can be dragged to change their order
  - The routine should be saved in the local storage and can be loaded from it

- [ ] **Exercise Launch**
  - Confirm selection
  - Start button

### 4.2 Canvas View Enhancements

- [ ] **Controls Overlay**
  - Pause/Resume button
  - Settings access
  - Back to menu button
  - Score display

- [ ] **Real-time Feedback Dashboard**
  - Current rep count
  - Current set count
  - Time elapsed
  - Validation status
  - Performance metrics

### 4.3 Pause Screen

- [ ] **Functionality**
  - Resume exercise
  - Restart exercise
  - Return to menu
  - Settings access

- [ ] **Visual Design**
  - Semi-transparent overlay
  - Clear button hierarchy
  - Touch-friendly sizes

### 4.4 Score Screen

- [ ] **Performance Summary**
  - Total reps completed
  - Total sets completed
  - Average form quality
  - Estimated calories burned (optional)

- [ ] **Detailed Breakdown**
  - Per-rep scores
  - Per-rep timing accuracy
  - Common mistakes detected
  - Improvement areas

### 4.5 Summary Screen

- [ ] **Session Summary**
  - Date/time
  - Exercise name
  - Total duration
  - Total reps/sets
  - Overall score

- [ ] **History Integration**
  - Save to PouchDB
  - Show trend (last 7 days)
  - Compare to previous sessions

### 4.6 Settings Screen

- [ ] **User Preferences**
  - Difficulty level
  - Feedback verbosity
  - Visual preferences (colors, opacity)
  - Audio on/off

- [ ] **Performance Settings**
  - Backend selection (WebGL/WASM)
  - Model resolution
  - Frame rate cap

- [ ] **Data Management**
  - Export session history
  - Clear history
  - Database info

---

## 💾 Phase 5: Local Storage & Data Management (Weeks 9-10)

### 5.1 Session Persistence

- [ ] **Session Model**
  - Create session documents in PouchDB
  - Track: exercise_id, date, reps, sets, score, duration
  - Include timestamp and user metadata

- [ ] **Session Saving**
  - Auto-save during exercise
  - Final save on completion
  - Error handling and retry logic

### 5.2 Exercise History

- [ ] **History Queries**
  - Get sessions for a specific exercise
  - Get all sessions (date range)
  - Calculate statistics (best score, total reps, etc.)

- [ ] **Trend Analysis**
  - Weekly summaries
  - Monthly summaries
  - Progress tracking (improvements over time)

### 5.3 Data Export

- [ ] **Export Functionality**
  - Export to CSV
  - Export to JSON
  - Include timestamps and metadata

- [ ] **Cloud Sync (Optional Future)**
  - Prepare architecture for future cloud sync
  - Design sync strategy without breaking offline-first
  - Document sync API contract

---

## 🔧 Phase 6: Performance & Optimization (Weeks 11-12)

### 6.1 Web Worker Integration

- [ ] **Move Heavy Processing to Workers**
  - Angle calculations
  - FSM/graph evaluation
  - Temporal constraint checking
  - Score computation

- [ ] **Worker Communication**
  - Message protocol definition
  - Error handling
  - Performance benchmarking

### 6.2 Hardware Abstraction

- [ ] **Backend Selection Strategy**
  - Detect available backends (WebGL, WASM, WebGPU)
  - Fallback chain: WebGL → WASM
  - Performance profiling per backend

- [ ] **Device-Specific Optimization**
  - SBC detection
  - Memory limitations handling
  - Frame rate adaptation

### 6.3 Rendering Optimization

- [ ] **Canvas Performance**
  - Measure frame times
  - Profile drawing calls
  - Implement culling (off-screen geometry)
  - Batch same-type draws

- [ ] **Memory Management**
  - Monitor memory usage
  - Clear unused resources
  - Garbage collection tuning

---

## 🎮 Phase 7: Advanced Features (Weeks 13-14)

### 7.1 DTW-Based Scoring (Optional)

- [ ] **Dynamic Time Warping Implementation**
  - Compare user trajectory to reference
  - Provide similarity score
  - Handle varying speeds

### 7.2 Tutor Recording Mode

- [ ] **Exercise Definition Creation UI**
  - Record reference pose phases
  - Define angles and ranges interactively
  - Generate exercise JSON

- [ ] **Verification**
  - Test recorded exercises
  - Adjust parameters
  - Export exercises

### 7.3 Multi-User Profiles

- [ ] **User Management**
  - Create/switch profiles
  - Store user preferences
  - Separate history per user

- [ ] **Leaderboards (Local)**
  - Track best scores
  - Show progress over time

### 7.4 Advanced Visualization

- [ ] **3D Pose Visualization (Optional)**
  - Consider Three.js for depth visualization
  - Side-by-side user/ghost comparison

- [ ] **Motion Trail Rendering**
  - Show trajectory of joints
  - Highlight problem path segments

---

## 🧪 Phase 8: Testing & QA (Weeks 15-16)

### 8.1 Unit Tests

- [ ] Angle calculation accuracy
- [ ] FSM state transitions
- [ ] Graph evaluation logic
- [ ] Constraint checking
- [ ] Date/time calculations

### 8.2 Integration Tests

- [ ] Full exercise validation pipeline
- [ ] Canvas rendering with multiple elements
- [ ] PouchDB operations
- [ ] State persistence

### 8.3 E2E Tests

- [ ] Complete exercise execution
- [ ] Score calculation accuracy
- [ ] Session history tracking
- [ ] UI navigation flows

### 8.4 Performance Benchmarks

- [ ] Pose detection latency
- [ ] Validation logic speed
- [ ] Canvas rendering FPS
- [ ] Memory usage profiling

### 8.5 Hardware Testing

- [ ] Test on Radxa SBC (target hardware)
- [ ] Test on various Chromium versions
- [ ] Test camera compatibility
- [ ] Test disk I/O with PouchDB

---

## 📦 Phase 9: Documentation & Deployment (Weeks 17-18)

### 9.1 Technical Documentation

- [ ] **ARCHITECTURE.md** - Complete architecture diagrams
- [ ] **API Contracts** - Exercise definition schema
- [ ] **Component Documentation** - Each major module
- [ ] **Data Structures** - FSM, graphs, constraints

### 9.2 User Documentation

- [ ] **User Guide** - How to use the mirror
- [ ] **Exercise Library** - Available exercises
- [ ] **Troubleshooting** - Common issues
- [ ] **FAQ** - Frequent questions

### 9.3 Developer Documentation

- [ ] **Setup Guide** - Dev environment
- [ ] **Contributing Guidelines** - For contributors
- [ ] **Building Custom Exercises** - Tutor workflow
- [ ] **Debugging Tips** - Performance profiling

### 9.4 Deployment

- [ ] **Build Process**
  - Optimize build for embedded
  - Reduce bundle size
  - Asset optimization

- [ ] **Deployment Scripts**
  - SBC flashing tools
  - Auto-update mechanism
  - Rollback strategy

---

## 🎯 Priority Matrix

### 🔴 Critical (Must Have)

1. Angle calculation accuracy
2. FSM-based validation
3. Event graph engine
4. Temporal constraints
5. Canvas rendering (user skeleton)
6. Menu & exercise selection
7. History persistence

### 🟡 Important (Should Have)

1. Ghost pose comparison
2. Detailed feedback visualization
3. Score calculation
4. Settings screen
5. Performance optimization
6. Web Worker integration

### 🟢 Nice-to-Have (Could Have)

1. DTW scoring
2. Tutor mode
3. Multi-user profiles
4. 3D visualization
5. Advanced analytics

---

## 📌 Key Metrics & KPIs

### Performance

- **Pose Detection Latency**: < 100ms per frame
- **Validation Logic**: < 50ms per update
- **Canvas Rendering**: 30-60 FPS sustained
- **Memory Usage**: < 200MB on SBC

### Accuracy

- **Angle Calculation Error**: < 5 degrees
- **Joint Detection**: > 90% confidence threshold
- **Exercise Completion**: Deterministic (no heuristics)

### User Experience

- **Time to Start Exercise**: < 5 seconds
- **Feedback Latency**: < 200ms from pose change
- **Session Save Time**: < 2 seconds

---

## 📝 Notes

- **JSON as source of truth**: All exercise definitions live in JSON and can be migrated to DB
- **Local-first**: No cloud required for core functionality
- **Deterministic behavior**: FSMs and rules, not AI heuristics
- **Performance-first**: Target limited hardware (SBCs)
- **Privacy**: All data stays local

---

## 🔄 Version Milestones

| Version | Focus                    | Timeline |
| ------- | ------------------------ | -------- |
| 0.1.0   | Pose + FSM validation    | Week 4   |
| 0.2.0   | Canvas + Ghost poses     | Week 6   |
| 0.3.0   | Complete UI              | Week 8   |
| 0.4.0   | Data persistence         | Week 10  |
| 0.5.0   | Performance optimization | Week 12  |
| 0.6.0   | Advanced features        | Week 14  |
| 0.7.0   | Testing & polish         | Week 16  |
| 1.0.0   | Production ready         | Week 18  |

---

## 🚀 Getting Started

Each phase includes specific tasks. Start with **Phase 1** and move sequentially. For parallel work, coordinate with the team leads.

---

_Last Updated: January 28, 2026_
_Maintained by: Development Team_
