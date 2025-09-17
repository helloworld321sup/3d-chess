// 3D Chess Game using Three.js and Chess.js
class ChessGame3D {
    constructor() {
        // Chess.js instance for game logic
        this.chess = new Chess();
        
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // Game state
        this.selectedPiece = null;
        this.selectedSquare = null;
        this.validMoves = [];
        this.pieces = new Map(); // Map of square notation to 3D piece objects
        this.squares = new Map(); // Map of square notation to 3D square objects
        this.capturedPieces = { white: [], black: [] };
        this.moveHistory = [];
        this.cameraMode = 0; // 0: free, 1: white perspective, 2: black perspective
        
        // Raycaster for mouse interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Colors and materials
        this.materials = {
            lightSquare: new THREE.MeshLambertMaterial({ color: 0xf0d9b5 }),
            darkSquare: new THREE.MeshLambertMaterial({ color: 0xb58863 }),
            selectedSquare: new THREE.MeshLambertMaterial({ color: 0x90EE90 }),
            validMoveSquare: new THREE.MeshLambertMaterial({ color: 0xFFFF99 }),
            whitePiece: new THREE.MeshLambertMaterial({ color: 0xffffff }),
            blackPiece: new THREE.MeshLambertMaterial({ color: 0x333333 }),
            selectedPiece: new THREE.MeshLambertMaterial({ color: 0x00ff00 })
        };
        
        this.init();
    }
    
    init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupLighting();
        this.createBoard();
        this.createPieces();
        this.setupControls();
        this.setupEventListeners();
        this.updateUI();
        this.animate();
        
        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';
    }
    
    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87CEEB);
    }
    
    setupCamera() {
        this.camera.position.set(0, 8, 8);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        this.scene.add(directionalLight);
        
        // Point light for better illumination
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);
    }
    
    createBoard() {
        const boardGroup = new THREE.Group();
        
        // Create squares
        for (let file = 0; file < 8; file++) {
            for (let rank = 0; rank < 8; rank++) {
                const squareGeometry = new THREE.BoxGeometry(1, 0.1, 1);
                const isLight = (file + rank) % 2 === 0;
                const material = isLight ? this.materials.lightSquare : this.materials.darkSquare;
                
                const square = new THREE.Mesh(squareGeometry, material);
                square.position.set(file - 3.5, 0, rank - 3.5);
                square.receiveShadow = true;
                
                // Store square reference
                const squareNotation = this.getSquareNotation(file, rank);
                square.userData = { square: squareNotation, file, rank };
                this.squares.set(squareNotation, square);
                
                boardGroup.add(square);
            }
        }
        
        // Create board frame
        const frameGeometry = new THREE.BoxGeometry(9, 0.2, 9);
        const frameMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(0, -0.15, 0);
        frame.receiveShadow = true;
        boardGroup.add(frame);
        
        this.scene.add(boardGroup);
    }
    
    createPieces() {
        const board = this.chess.board();
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[7 - rank][file]; // Chess.js uses different coordinate system
                if (piece) {
                    const squareNotation = this.getSquareNotation(file, rank);
                    this.createPiece(piece, squareNotation);
                }
            }
        }
    }
    
    createPiece(piece, square) {
        const [file, rank] = this.parseSquare(square);
        const geometry = this.getPieceGeometry(piece.type);
        const material = piece.color === 'w' ? this.materials.whitePiece.clone() : this.materials.blackPiece.clone();
        
        const pieceMesh = new THREE.Mesh(geometry, material);
        pieceMesh.position.set(file - 3.5, 0.5, rank - 3.5);
        pieceMesh.castShadow = true;
        pieceMesh.userData = { piece: piece, square: square };
        
        this.pieces.set(square, pieceMesh);
        this.scene.add(pieceMesh);
    }
    
    getPieceGeometry(type) {
        switch (type) {
            case 'p': // Pawn
                return new THREE.ConeGeometry(0.2, 0.8, 8);
            case 'r': // Rook
                return new THREE.BoxGeometry(0.4, 0.8, 0.4);
            case 'n': // Knight
                return new THREE.ConeGeometry(0.25, 0.8, 6);
            case 'b': // Bishop
                return new THREE.ConeGeometry(0.2, 1.0, 8);
            case 'q': // Queen
                return new THREE.ConeGeometry(0.3, 1.2, 8);
            case 'k': // King
                return new THREE.CylinderGeometry(0.25, 0.25, 1.0, 8);
            default:
                return new THREE.SphereGeometry(0.3);
        }
    }
    
    setupControls() {
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI / 2;
    }
    
    setupEventListeners() {
        // Mouse events
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
        
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Keyboard events
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
    }
    
    onMouseClick(event) {
        this.updateMousePosition(event);
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            
            if (intersectedObject.userData.square) {
                this.handleSquareClick(intersectedObject.userData.square);
            }
        }
    }
    
    onMouseMove(event) {
        this.updateMousePosition(event);
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        // Change cursor when hovering over pieces
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            if (intersectedObject.userData.piece) {
                document.body.style.cursor = 'pointer';
            } else {
                document.body.style.cursor = 'default';
            }
        } else {
            document.body.style.cursor = 'default';
        }
    }
    
    updateMousePosition(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    handleSquareClick(square) {
        if (this.selectedPiece) {
            // Try to make a move
            this.attemptMove(this.selectedSquare, square);
        } else {
            // Select a piece
            this.selectPiece(square);
        }
    }
    
    selectPiece(square) {
        const piece = this.chess.get(square);
        
        if (piece && piece.color === this.chess.turn()) {
            this.selectedPiece = this.pieces.get(square);
            this.selectedSquare = square;
            
            // Highlight selected piece
            this.selectedPiece.material = this.materials.selectedPiece.clone();
            
            // Show valid moves
            this.showValidMoves(square);
            
            // Update square highlighting
            this.updateSquareHighlighting();
        }
    }
    
    showValidMoves(square) {
        this.validMoves = this.chess.moves({ square: square, verbose: true });
        
        this.validMoves.forEach(move => {
            const targetSquare = this.squares.get(move.to);
            if (targetSquare) {
                targetSquare.material = this.materials.validMoveSquare.clone();
            }
        });
    }
    
    attemptMove(from, to) {
        const move = this.chess.move({ from: from, to: to, promotion: 'q' });
        
        if (move) {
            this.executeMove(move);
            this.clearSelection();
            this.updateUI();
            this.checkGameEnd();
        } else {
            // Invalid move, try selecting new piece
            this.clearSelection();
            this.selectPiece(to);
        }
    }
    
    executeMove(move) {
        // Store move in history
        this.moveHistory.push({
            move: move,
            fen: this.chess.fen()
        });
        
        // Handle piece capture
        if (move.captured) {
            this.handleCapture(move.to, move.captured, move.color === 'w' ? 'b' : 'w');
        }
        
        // Move piece in 3D scene
        this.movePiece3D(move.from, move.to);
        
        // Handle special moves
        if (move.flags.includes('c')) { // Castling
            this.handleCastling(move);
        }
        
        if (move.flags.includes('e')) { // En passant
            this.handleEnPassant(move);
        }
        
        if (move.promotion) {
            this.handlePromotion(move);
        }
    }
    
    movePiece3D(from, to) {
        const piece = this.pieces.get(from);
        if (piece) {
            const [toFile, toRank] = this.parseSquare(to);
            
            // Animate piece movement
            const targetPosition = new THREE.Vector3(toFile - 3.5, 0.5, toRank - 3.5);
            this.animatePieceMovement(piece, targetPosition);
            
            // Update piece mapping
            this.pieces.delete(from);
            this.pieces.set(to, piece);
            piece.userData.square = to;
        }
    }
    
    animatePieceMovement(piece, targetPosition) {
        // Simple animation - in a real game you might want smoother animations
        piece.position.copy(targetPosition);
    }
    
    handleCapture(square, capturedPieceType, capturedColor) {
        const capturedPiece = this.pieces.get(square);
        if (capturedPiece) {
            this.scene.remove(capturedPiece);
            this.pieces.delete(square);
            
            // Add to captured pieces UI
            const capturedList = capturedColor === 'w' ? 'whiteCaptured' : 'blackCaptured';
            this.addCapturedPieceToUI(capturedPieceType, capturedColor, capturedList);
        }
    }
    
    handleCastling(move) {
        // Handle rook movement in castling
        let rookFrom, rookTo;
        
        if (move.to === 'g1') { // White kingside
            rookFrom = 'h1';
            rookTo = 'f1';
        } else if (move.to === 'c1') { // White queenside
            rookFrom = 'a1';
            rookTo = 'd1';
        } else if (move.to === 'g8') { // Black kingside
            rookFrom = 'h8';
            rookTo = 'f8';
        } else if (move.to === 'c8') { // Black queenside
            rookFrom = 'a8';
            rookTo = 'd8';
        }
        
        if (rookFrom && rookTo) {
            this.movePiece3D(rookFrom, rookTo);
        }
    }
    
    handleEnPassant(move) {
        // Remove the captured pawn
        const capturedPawnSquare = move.to[0] + move.from[1];
        const capturedPawn = this.pieces.get(capturedPawnSquare);
        if (capturedPawn) {
            this.scene.remove(capturedPawn);
            this.pieces.delete(capturedPawnSquare);
            
            const capturedColor = move.color === 'w' ? 'b' : 'w';
            const capturedList = capturedColor === 'w' ? 'whiteCaptured' : 'blackCaptured';
            this.addCapturedPieceToUI('p', capturedColor, capturedList);
        }
    }
    
    handlePromotion(move) {
        // Replace pawn with promoted piece
        const piece = this.pieces.get(move.to);
        if (piece) {
            this.scene.remove(piece);
            
            // Create new promoted piece
            const promotedPiece = {
                type: move.promotion,
                color: move.color
            };
            this.createPiece(promotedPiece, move.to);
        }
    }
    
    clearSelection() {
        if (this.selectedPiece) {
            // Restore original material
            const piece = this.selectedPiece.userData.piece;
            this.selectedPiece.material = piece.color === 'w' ? 
                this.materials.whitePiece.clone() : this.materials.blackPiece.clone();
        }
        
        this.selectedPiece = null;
        this.selectedSquare = null;
        this.validMoves = [];
        
        this.updateSquareHighlighting();
    }
    
    updateSquareHighlighting() {
        // Reset all square materials
        this.squares.forEach((square, notation) => {
            const [file, rank] = this.parseSquare(notation);
            const isLight = (file + rank) % 2 === 0;
            square.material = isLight ? this.materials.lightSquare.clone() : this.materials.darkSquare.clone();
        });
        
        // Highlight selected square
        if (this.selectedSquare) {
            const selectedSquareMesh = this.squares.get(this.selectedSquare);
            if (selectedSquareMesh) {
                selectedSquareMesh.material = this.materials.selectedSquare.clone();
            }
        }
        
        // Highlight valid move squares
        this.validMoves.forEach(move => {
            const targetSquare = this.squares.get(move.to);
            if (targetSquare) {
                targetSquare.material = this.materials.validMoveSquare.clone();
            }
        });
    }
    
    updateUI() {
        // Update turn indicator
        const turnIndicator = document.getElementById('turnIndicator');
        turnIndicator.textContent = this.chess.turn() === 'w' ? "White's Turn" : "Black's Turn";
        
        // Update game status
        const gameStatus = document.getElementById('gameStatus');
        if (this.chess.isCheckmate()) {
            gameStatus.textContent = this.chess.turn() === 'w' ? "Black Wins!" : "White Wins!";
        } else if (this.chess.isDraw()) {
            gameStatus.textContent = "Game is a Draw";
        } else if (this.chess.isCheck()) {
            gameStatus.textContent = "Check!";
        } else {
            gameStatus.textContent = "Game in Progress";
        }
    }
    
    addCapturedPieceToUI(pieceType, color, listId) {
        const capturedList = document.getElementById(listId);
        const pieceElement = document.createElement('div');
        pieceElement.className = 'captured-piece';
        pieceElement.textContent = this.getPieceSymbol(pieceType, color);
        capturedList.appendChild(pieceElement);
    }
    
    getPieceSymbol(type, color) {
        const symbols = {
            'p': color === 'w' ? '♙' : '♟',
            'r': color === 'w' ? '♖' : '♜',
            'n': color === 'w' ? '♘' : '♞',
            'b': color === 'w' ? '♗' : '♝',
            'q': color === 'w' ? '♕' : '♛',
            'k': color === 'w' ? '♔' : '♚'
        };
        return symbols[type] || '?';
    }
    
    checkGameEnd() {
        if (this.chess.isGameOver()) {
            setTimeout(() => {
                if (this.chess.isCheckmate()) {
                    alert(`Checkmate! ${this.chess.turn() === 'w' ? 'Black' : 'White'} wins!`);
                } else if (this.chess.isDraw()) {
                    alert('Game is a draw!');
                }
            }, 100);
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    onKeyDown(event) {
        switch (event.code) {
            case 'Escape':
                this.clearSelection();
                break;
            case 'KeyR':
                this.resetGame();
                break;
            case 'KeyU':
                this.undoMove();
                break;
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
    
    // Utility functions
    getSquareNotation(file, rank) {
        return String.fromCharCode(97 + file) + (rank + 1);
    }
    
    parseSquare(square) {
        const file = square.charCodeAt(0) - 97;
        const rank = parseInt(square[1]) - 1;
        return [file, rank];
    }
}

// Global functions for UI buttons
function resetGame() {
    // Clear the scene and restart
    game.chess.reset();
    
    // Remove all pieces from scene
    game.pieces.forEach(piece => {
        game.scene.remove(piece);
    });
    game.pieces.clear();
    
    // Clear captured pieces UI
    document.getElementById('whiteCaptured').innerHTML = '';
    document.getElementById('blackCaptured').innerHTML = '';
    
    // Recreate pieces
    game.createPieces();
    game.clearSelection();
    game.updateUI();
    game.moveHistory = [];
}

function toggleCamera() {
    game.cameraMode = (game.cameraMode + 1) % 3;
    
    switch (game.cameraMode) {
        case 0: // Free camera
            game.controls.enabled = true;
            break;
        case 1: // White perspective
            game.controls.enabled = false;
            game.camera.position.set(0, 8, 8);
            game.camera.lookAt(0, 0, 0);
            break;
        case 2: // Black perspective
            game.controls.enabled = false;
            game.camera.position.set(0, 8, -8);
            game.camera.lookAt(0, 0, 0);
            break;
    }
}

function undoMove() {
    if (game.moveHistory.length > 0) {
        game.chess.undo();
        game.moveHistory.pop();
        
        // Remove all pieces and recreate from current position
        game.pieces.forEach(piece => {
            game.scene.remove(piece);
        });
        game.pieces.clear();
        
        game.createPieces();
        game.clearSelection();
        game.updateUI();
        
        // Update captured pieces UI (simplified - in a full implementation you'd track this better)
        document.getElementById('whiteCaptured').innerHTML = '';
        document.getElementById('blackCaptured').innerHTML = '';
    }
}

// Initialize the game when the page loads
let game;

function initializeGame() {
    console.log('Checking libraries...');
    console.log('THREE:', typeof THREE);
    console.log('Chess:', typeof Chess);
    console.log('OrbitControls:', typeof THREE !== 'undefined' ? typeof THREE.OrbitControls : 'THREE not loaded');
    
    // Check if required libraries are loaded
    if (typeof THREE === 'undefined') {
        console.error('Three.js is not loaded');
        document.getElementById('loadingScreen').innerHTML = '<h2>Error: Three.js failed to load</h2>';
        return;
    }
    
    if (typeof Chess === 'undefined') {
        console.error('Chess.js is not loaded');
        document.getElementById('loadingScreen').innerHTML = '<h2>Error: Chess.js failed to load</h2>';
        return;
    }
    
    if (typeof THREE.OrbitControls === 'undefined') {
        console.error('OrbitControls is not loaded');
        document.getElementById('loadingScreen').innerHTML = '<h2>Error: OrbitControls failed to load</h2>';
        return;
    }
    
    console.log('All libraries loaded, initializing game...');
    try {
        game = new ChessGame3D();
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Error initializing game:', error);
        document.getElementById('loadingScreen').innerHTML = '<h2>Error initializing game: ' + error.message + '</h2>';
    }
}

// Wait a bit for all scripts to load, then initialize
window.addEventListener('load', () => {
    setTimeout(initializeGame, 100);
});
