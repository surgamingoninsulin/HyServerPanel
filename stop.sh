#!/bin/bash

# Read the ID numbers and kill the processes
kill $(cat backend.pid)
kill $(cat frontend.pid)

# Clean up the ID files
rm backend.pid frontend.pid

echo "Project stopped!"