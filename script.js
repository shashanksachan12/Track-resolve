
    const TOTAL_FLEET_SIZE = 25;
    const RAKE_WIDTH = 40;
    const STOPPING_GAP = 18;
    const MAX_LOOPS = 1; 
    const INITIAL_SPEED = 2.5;
    
    let activeRakes = [];
    let trackStates = {};
    let animationFrameId = null;

    function calculatePredictions(data) {
        let { dow, is_weekend, is_holiday, special_event, temp } = data;
        let line1 = 5, line2 = 4, line3 = 4;
        if (is_weekend) { line1 += 3; line2 += 2; line3 += 2; }
        if (is_holiday) { line1 += 2; line2 += 3; line3 += 3; }
        if (special_event) { line1 += 2; line2 += 3; line3 += 4; }
        if (temp > 35) { line1 = Math.max(1, line1 - 1); line2 = Math.max(1, line2 - 1); }
        return { Line1: line1, Line2: line2, Line3: line3 };
    }

    document.getElementById("predictForm").addEventListener("submit", function(e) {
        e.preventDefault();
        const data = {
            dow: parseInt(document.getElementById("dow").value),
            month: parseInt(document.getElementById("month").value),
            is_weekend: parseInt(document.getElementById("is_weekend").value),
            is_holiday: parseInt(document.getElementById("is_holiday").value),
            special_event: parseInt(document.getElementById("special_event").value),
            temp: parseFloat(document.getElementById("temp").value)
        };
        
        const predictions = calculatePredictions(data);
        const totalDemand = predictions.Line1 + predictions.Line2 + predictions.Line3;

        const maintenanceRakes = Math.floor(Math.random() * 2) + 1;
        const availableFleet = TOTAL_FLEET_SIZE - maintenanceRakes;
        const reserveOrShortfall = availableFleet - totalDemand;
        
        let deployedRakes = {};
        if (totalDemand <= availableFleet) {
            deployedRakes = predictions;
        } else {
            let remainingToDeploy = availableFleet;
            deployedRakes.Line1 = Math.min(predictions.Line1, remainingToDeploy);
            remainingToDeploy -= deployedRakes.Line1;
            deployedRakes.Line2 = Math.min(predictions.Line2, remainingToDeploy);
            remainingToDeploy -= deployedRakes.Line2;
            deployedRakes.Line3 = Math.min(predictions.Line3, remainingToDeploy);
        }

        const totalDeployed = Object.values(deployedRakes).reduce((sum, val) => sum + val, 0);
        
        // MODIFICATION: Pass maintenanceRakes to the display function
        displayResults({
            totalDemand,
            totalDeployed,
            reserveOrShortfall,
            predictions,
            deployedRakes,
            maintenanceRakes
        });
        
        prepareAndStartAnimation(deployedRakes);
    });
    
    // MODIFICATION: Function now accepts maintenanceRakes and displays the new stats
    function displayResults(data) {
        const resultsBox = document.getElementById("results");
        resultsBox.style.display = "block";
        const { totalDemand, totalDeployed, reserveOrShortfall, predictions, deployedRakes, maintenanceRakes } = data;
        const shortfallStatus = reserveOrShortfall < 0 ? 'Shortfall' : 'Reserve';
        const shortfallClass = reserveOrShortfall < 0 ? 'negative' : 'positive';
        
        resultsBox.innerHTML = `
            <h3>Fleet Status</h3>
            <div class="fleet-status">
                <div class="status-item"><h4>Total Fleet 🚆</h4><p>${TOTAL_FLEET_SIZE}</p></div>
                <div class="status-item"><h4>Maintenance 🛠️</h4><p class="negative">${maintenanceRakes}</p></div>
                <div class="status-item"><h4>Predicted Demand 📊</h4><p>${totalDemand}</p></div>
                <div class="status-item"><h4>Total Deployed 🚀</h4><p>${totalDeployed}</p></div>
                <div class="status-item"><h4>${shortfallStatus}</h4><p class="${shortfallClass}">${Math.abs(reserveOrShortfall)}</p></div>
            </div>
            <h3>Deployment Details</h3>
            <table>
                <tr><th>Line</th><th>Predicted Demand</th><th>Rakes Deployed</th></tr>
                ${Object.keys(predictions).map(line => `
                    <tr class="${(deployedRakes[line] || 0) < predictions[line] ? 'shortfall' : ''}">
                        <td>${line}</td>
                        <td>${predictions[line]}</td>
                        <td>${deployedRakes[line] || 0}</td>
                    </tr>
                `).join('')}
            </table>`;
    }

    function prepareAndStartAnimation(deployedRakes) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        document.querySelectorAll(".rake, .brake-indicator, .signal-light").forEach(el => el.remove());
        activeRakes = [];
        trackStates = {};

        const trackInfo = {
            Line1: { top: 35, color: '#3498db' },
            Line2: { top: 95, color: '#2ecc71' },
            Line3: { top: 155, color: '#e67e22' }
        };

        for (const line in deployedRakes) {
            if (!trackInfo[line]) continue; 

            const count = deployedRakes[line];
            if (count === 0) continue;

            const brakeIndicatorEl = document.createElement('div');
            brakeIndicatorEl.className = 'brake-indicator';
            brakeIndicatorEl.style.top = (trackInfo[line].top) + 'px';
            document.getElementById('metro-map').appendChild(brakeIndicatorEl);
            
            const signalLightEl = document.createElement('div');
            signalLightEl.className = 'signal-light green active'; // Start as green
            signalLightEl.style.top = (trackInfo[line].top - 5) + 'px';
            document.getElementById('metro-map').appendChild(signalLightEl);

            trackStates[line] = { 
                brakeIndicatorEl, 
                signalLight: signalLightEl,
                isRed: false,
                allReadyForFinalRun: false
            };
            
            const spacing = (document.getElementById('metro-map').clientWidth - 100) / Math.max(count, 1);
            for (let i = 0; i < count; i++) {
                const rakeEl = document.createElement("div");
                rakeEl.className = "rake";
                rakeEl.style.background = trackInfo[line].color;
                rakeEl.style.top = (trackInfo[line].top) + "px";
                rakeEl.textContent = i + 1;
                document.getElementById("metro-map").appendChild(rakeEl);
                
                activeRakes.push({
                    element: rakeEl, line: line, index: i,
                    initialPosition: -RAKE_WIDTH - i * spacing, 
                    position: -RAKE_WIDTH - i * spacing,
                    speed: INITIAL_SPEED, isBraking: false, isStopped: false,
                    loopCount: 0, maxLoops: MAX_LOOPS
                });
            }
        }
        animationLoop();
    }

    function animationLoop() {
        if (!activeRakes.length) return;
        let allStopped = true;
        const trackWidth = document.getElementById('metro-map').clientWidth - 100;

        const rakesByLine = activeRakes.reduce((acc, rake) => {
            if (!acc[rake.line]) acc[rake.line] = [];
            acc[rake.line][rake.index] = rake;
            return acc;
        }, {});

        for (const line in rakesByLine) {
            const lineState = trackStates[line];
            if (!lineState.allReadyForFinalRun) {
                lineState.allReadyForFinalRun = rakesByLine[line].every(r => r.loopCount >= MAX_LOOPS);
            }
        }
        
        for (const rake of activeRakes) {
            if (rake.isStopped) continue;
            allStopped = false;

            const lineState = trackStates[rake.line];

            if (lineState.allReadyForFinalRun) {
                const trainInFront = rakesByLine[rake.line][rake.index - 1];
                let targetPosition;
                
                if (!trainInFront) { // This is the lead train
                    targetPosition = trackWidth - RAKE_WIDTH;
                    if (!lineState.isRed) {
                        lineState.signalLight.classList.remove('green');
                        lineState.signalLight.classList.add('red', 'active');
                        lineState.brakeIndicatorEl.style.opacity = '1';
                        lineState.isRed = true;
                    }
                    lineState.brakeIndicatorEl.style.transform = `translateY(-5px) translateX(${targetPosition}px)`;
                } else {
                    targetPosition = trainInFront.position - RAKE_WIDTH - STOPPING_GAP;
                }

                if (rake.position > targetPosition - 150 && !rake.isBraking) {
                    rake.isBraking = true;
                }
                if (rake.isBraking) {
                    rake.speed *= 0.95;
                }
                if (rake.position >= targetPosition) {
                    rake.position = targetPosition;
                    if (trainInFront && !trainInFront.isStopped) {
                        rake.speed = trainInFront.speed;
                    } else {
                        rake.speed = 0;
                        rake.isStopped = true;
                    }
                }
            } else {
                if (rake.position > trackWidth + RAKE_WIDTH) {
                    if (rake.loopCount < rake.maxLoops) {
                        rake.loopCount++;
                        rake.position = rake.initialPosition;
                    }
                }
            }
            
            rake.position += rake.speed;
            rake.element.style.transform = `translateX(${rake.position}px)`;
        }

        if (!allStopped) {
            animationFrameId = requestAnimationFrame(animationLoop);
        }
    }