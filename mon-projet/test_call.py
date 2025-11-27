#!/usr/bin/env python3
"""Test direct du module call_test"""

import sys
import os
sys.path.append('src/backend')

from modules.telco_modules import TelcoModules

def test_call():
    print("Testing call_test module...")
    
    # Create executor
    executor = TelcoModules()
    
    # Test call with *123#
    result = executor.call_test("*123#", 1)
    
    print("Result:", result)
    return result

if __name__ == "__main__":
    test_call()