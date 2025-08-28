// Simplified AI Worker for debugging
self.onmessage = (e) => {
    console.log('AI Worker (Debug): Message received. Board state is ignored.');
    
    // Simulate thinking for 1 second
    setTimeout(() => {
        const move = [9, 9]; // Always return the center square
        console.log('AI Worker (Debug): Sending back hardcoded move:', move);
        self.postMessage(move);
    }, 1000);
};