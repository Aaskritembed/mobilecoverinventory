#!/bin/bash

echo "🚀 Starting Mobile Cover Inventory Management System"
echo "=================================================="

# Function to kill processes on port 3000
kill_port_processes() {
    echo "🔍 Checking for processes on port 3000..."
    
    # Get PID of process using port 3000
    PID=$(lsof -ti:3000 2>/dev/null)
    
    if [ ! -z "$PID" ]; then
        echo "⚠️  Found process using port 3000: $PID"
        echo "🛑 Killing process..."
        kill -9 $PID 2>/dev/null
        sleep 2
    else
        echo "✅ Port 3000 is available"
    fi
    
    # Kill any hanging node processes
    pkill -f "node server.js" 2>/dev/null
    sleep 1
}

# Function to check if database directory exists
setup_database() {
    echo "🗄️  Setting up database directory..."
    mkdir -p database
    mkdir -p uploads
}

# Function to install dependencies if needed
install_deps() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install
    else
        echo "✅ Dependencies already installed"
    fi
}

# Function to start the server
start_server() {
    echo "🌟 Starting the enhanced server..."
    echo ""
    echo "📋 System Information:"
    echo "   • Port: 3000"
    echo "   • Environment: development"
    echo "   • Database: ./database/inventory.db"
    echo "   • Upload Directory: ./uploads"
    echo ""
    echo "🔗 Available Endpoints:"
    echo "   • Main App: http://localhost:3000"
    echo "   • API Health: http://localhost:3000/api/health"
    echo "   • Products: http://localhost:3000/products"
    echo "   • Sales: http://localhost:3000/sales"
    echo "   • Employees: http://localhost:3000/employees"
    echo ""
    echo "🎯 Modernized Features:"
    echo "   ✅ Promise-based transaction system"
    echo "   ✅ Modular API routes"
    echo "   ✅ Standardized responses"
    echo "   ✅ Advanced analytics"
    echo "   ✅ Performance caching"
    echo "   ✅ Enhanced security"
    echo ""
    
    # Start the server
    node server.js
}

# Main execution
main() {
    echo "🔧 Starting system setup..."
    
    kill_port_processes
    setup_database
    install_deps
    
    echo ""
    echo "✅ Setup complete! Starting server..."
    echo ""
    
    start_server
}

# Run main function
main
