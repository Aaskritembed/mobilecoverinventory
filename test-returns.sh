#!/bin/bash

echo "Testing POST /api/returns with slip_path field..."

# Test with slip_path
response=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST http://localhost:3000/api/returns \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "Test Customer with Slip",
    "customer_email": "test@example.com",
    "customer_phone": "+1-555-0123",
    "product_name": "Test Product",
    "quantity": 1,
    "return_reason": "Quality Defect",
    "return_condition": "good",
    "sales_platform": "Amazon",
    "notes": "Test return with slip path",
    "slip_path": "/uploads/slip-test-12345.pdf"
  }')

# Extract HTTP status and response body
http_status=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
response_body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $http_status"
echo "Response: $response_body"

if [ "$http_status" = "200" ] || [ "$http_status" = "201" ]; then
    echo "✅ SUCCESS: Returns API accepts slip_path field!"
    
    # Test without slip_path to make sure backward compatibility works
    echo ""
    echo "Testing backward compatibility (without slip_path)..."
    response2=$(curl -s -w "HTTP_STATUS:%{http_code}" -X POST http://localhost:3000/api/returns \
      -H "Content-Type: application/json" \
      -d '{
        "customer_name": "Test Customer without Slip",
        "quantity": 1,
        "return_reason": "Quality Defect"
      }')
    
    http_status2=$(echo "$response2" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    response_body2=$(echo "$response2" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    echo "HTTP Status: $http_status2"
    echo "Response: $response_body2"
    
    if [ "$http_status2" = "200" ] || [ "$http_status2" = "201" ]; then
        echo "✅ SUCCESS: Backward compatibility works (slip_path is optional)"
    else
        echo "❌ FAILED: Backward compatibility issue"
    fi
    
else
    echo "❌ FAILED: Returns API does not accept slip_path field"
fi
