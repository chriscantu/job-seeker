#!/opt/homebrew/bin/fish
#
# Manage the daily digest launchd agent.
# Usage: digest-cron.fish [enable|disable|status|run]

set plist_path ~/Library/LaunchAgents/com.jobseeker.daily-digest.plist
set label com.jobseeker.daily-digest

function usage
    echo "Usage: digest-cron.fish [enable|disable|status|run]"
    echo ""
    echo "  enable   Load the launchd agent (starts firing at 7:03am daily)"
    echo "  disable  Unload the launchd agent (stops all scheduled runs)"
    echo "  status   Show whether the agent is loaded and next fire time"
    echo "  run      Trigger an immediate run"
end

if test (count $argv) -ne 1
    usage
    exit 1
end

switch $argv[1]
    case enable
        if not test -f $plist_path
            echo "Error: plist not found at $plist_path"
            echo "Re-run the setup or check the job-seeker README."
            exit 1
        end
        launchctl load $plist_path 2>&1
        and echo "Digest cron enabled — fires daily at 7:03am."
        or echo "Failed to load agent (may already be loaded)."

    case disable
        launchctl unload $plist_path 2>&1
        and echo "Digest cron disabled. Re-enable with: digest-cron.fish enable"
        or echo "Agent not loaded or already disabled."

    case status
        if launchctl list | grep -q $label
            echo "Status: ENABLED"
            echo "Label:  $label"
            echo "Plist:  $plist_path"
            echo "Schedule: 7:03am daily (local time)"
            echo ""
            echo "Recent logs:"
            set -l latest (ls -t ~/repos/job-seeker/output/cron-logs/digest-*.log 2>/dev/null | head -1)
            if test -n "$latest"
                tail -3 $latest
            else
                echo "  (no logs yet)"
            end
        else
            echo "Status: DISABLED"
        end

    case run
        if not launchctl list | grep -q $label
            echo "Agent is not loaded. Run 'digest-cron.fish enable' first."
            exit 1
        end
        launchctl start $label
        echo "Triggered. Check output/cron-logs/ for progress."

    case '*'
        usage
        exit 1
end
