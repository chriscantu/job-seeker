#!/opt/homebrew/bin/fish
#
# Unattended daily digest runner for launchd.
# Invokes claude -p with the /daily-digest skill and logs output.

set project_dir /Users/cantu/repos/job-seeker
set log_dir $project_dir/output/cron-logs
set today (date +%Y-%m-%d)
set log_file $log_dir/digest-$today.log

# Ensure log dir exists
mkdir -p $log_dir

# Add homebrew to PATH (launchd has minimal env)
set -x PATH /opt/homebrew/bin $PATH

echo "[$today "(date +%H:%M:%S)"] Starting daily digest" >> $log_file

cd $project_dir

echo "Run /daily-digest now. This is an unattended cron run — do not ask questions, just execute the skill. After the digest completes, report a one-line summary of how many new roles were found. Do NOT run scan-email." \
    | claude -p \
    --permission-mode auto \
    --model sonnet \
    --max-budget-usd 1.00 \
    --allowedTools "Read,Write,Edit,Bash,WebSearch,WebFetch,Glob,Grep" \
    >> $log_file 2>&1

set exit_code $status

echo "[$today "(date +%H:%M:%S)"] Finished with exit code $exit_code" >> $log_file

exit $exit_code
